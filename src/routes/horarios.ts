import { Router, Request, Response } from 'express';
import { getPrisma } from '../db/prisma.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware.js';

const router = Router();

/**
 * GET /api/horarios
 * Público: Lista horários/turnos disponíveis ou filtrados por médico
 * Resiliente: funciona tanto com o schema novo (colunas extras) quanto com o legado
 */
router.get('/', async (req: Request, res: Response) => {
  const { medico_id, apenas_disponiveis } = req.query;

  try {
    const prisma = getPrisma();
    const whereClause: any = {};

    if (medico_id) {
      whereClause.medico_id = Number(medico_id);
    }

    let horarios: any[] = [];
    const includeQuery: any = {
      medico: { select: { id: true, nome: true, especialidade: true } }
    };

    try {
      // Tenta buscar incluindo agendamentos e status_disponivel (schema novo)
      const fullWhere = { ...whereClause };
      if (apenas_disponiveis === 'true') {
        fullWhere.status_disponivel = true;
      }
      horarios = await prisma.horario.findMany({
        where: fullWhere,
        include: {
          ...includeQuery,
          agendamentos: { select: { id: true, nome_paciente: true, telefone: true } }
        },
        orderBy: { data_hora: 'asc' }
      });
    } catch (dbErr: any) {
      console.warn('Falha na busca completa de horários, tentando modo legado:', dbErr?.message);
      try {
        // Fallback legado: sem agendamentos e sem status_disponivel no where
        horarios = await prisma.horario.findMany({
          where: whereClause,
          include: includeQuery,
          orderBy: { data_hora: 'asc' }
        });
      } catch (dbErr2: any) {
        console.error('Falha também no modo legado:', dbErr2?.message);
        // Último fallback: busca mínima sem includes
        horarios = await prisma.horario.findMany({
          where: whereClause,
          orderBy: { data_hora: 'asc' }
        });
      }
    }

    const result = horarios.map((h: any) => ({
      id: h.id,
      data_hora: h.data_hora,
      hora_inicio: h.hora_inicio || '07:00',
      hora_fim: h.hora_fim || '11:00',
      vagas_totais: h.vagas_totais ?? 1,
      vagas_disponiveis: h.vagas_disponiveis ?? (h.status_disponivel ? 1 : 0),
      medico_id: h.medico_id,
      status_disponivel: Boolean(h.status_disponivel),
      medico: h.medico,
      agendamentos: h.agendamentos || []
    }));

    return res.json(result);
  } catch (error: any) {
    console.error('Erro ao listar horários:', error);
    return res.status(500).json({ error: 'Erro de SQL', message: 'Incapaz de ler os horários disponíveis.', details: error.message });
  }
});

/**
 * POST /api/horarios
 * Protegido: Cria um novo turno/bloco de atendimento para um médico determinado
 * Resiliente: tenta inserir com o schema completo e faz fallback progressivo
 */
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { data_hora, hora_inicio, hora_fim, vagas_totais, medico_id } = req.body;

  if (!data_hora || !medico_id) {
    return res.status(400).json({ error: 'Campos incorretos', message: 'Data e Identificador do Médico são obrigatórios.' });
  }

  const numVagas = Math.max(1, Number(vagas_totais) || 1);

  let dateObj = new Date(data_hora);
  if (isNaN(dateObj.getTime())) {
    dateObj = new Date();
  }

  try {
    const prisma = getPrisma();

    // Valida se o médico existe
    const medico = await prisma.medico.findUnique({
      where: { id: Number(medico_id) }
    });

    if (!medico) {
      return res.status(404).json({ error: 'Não encontrado', message: 'O médico indicado não existe.' });
    }

    let horario;
    try {
      // Tenta inserir com todos os campos (schema novo)
      horario = await prisma.horario.create({
        data: {
          data_hora: dateObj,
          hora_inicio: hora_inicio || '07:00',
          hora_fim: hora_fim || '11:00',
          vagas_totais: numVagas,
          vagas_disponiveis: numVagas,
          medico_id: Number(medico_id),
          status_disponivel: true
        }
      });
    } catch (createErr: any) {
      console.warn('Falha no insert completo do horário, tentando insert intermediário:', createErr?.message);
      try {
        // Fallback 1: Sem status_disponivel (caso a coluna não exista no schema antigo)
        horario = await prisma.horario.create({
          data: {
            data_hora: dateObj,
            hora_inicio: hora_inicio || '07:00',
            hora_fim: hora_fim || '11:00',
            vagas_totais: numVagas,
            vagas_disponiveis: numVagas,
            medico_id: Number(medico_id)
          } as any
        });
      } catch (err2: any) {
        console.warn('Falha no insert intermediário, tentando insert mínimo total:', err2?.message);
        // Fallback 2: Apenas os campos essenciais (compatível com schema original)
        horario = await prisma.horario.create({
          data: {
            data_hora: dateObj,
            medico_id: Number(medico_id)
          } as any
        });
      }
    }

    return res.status(201).json(horario);
  } catch (error: any) {
    console.error('Erro ao criar horário:', error);
    return res.status(500).json({ error: 'Erro de inserção', message: 'Não foi possível cadastrar o horário.', details: error.message });
  }
});

/**
 * DELETE /api/horarios/:id
 * Protegido: Remove um determinado turno/horário
 */
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const prisma = getPrisma();
    await prisma.horario.delete({
      where: { id: Number(id) }
    });
    return res.json({ success: true, message: 'Horário removido com sucesso!' });
  } catch (error: any) {
    console.error(`Erro ao remover horário ${id}:`, error);
    return res.status(500).json({ error: 'Erro ao remover', message: 'Incapaz de excluir.', details: error.message });
  }
});

export default router;
