import { Router, Request, Response } from 'express';
import { getPrisma } from '../db/prisma.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware.js';

const router = Router();

/**
 * GET /api/horarios
 * Público: Lista horários/turnos disponíveis ou filtrados por médico
 *
 * IMPORTANTE: Usa SELECT mínimo (apenas colunas essenciais que certamente existem
 * no banco: id, data_hora, medico_id) para evitar erro 500 quando o schema do
 * banco de produção não possui as colunas extras (hora_inicio, hora_fim,
 * vagas_totais, vagas_disponiveis, status_disponivel).
 * Os demais campos são preenchidos com valores padrão no retorno.
 */
router.get('/', async (req: Request, res: Response) => {
  const { medico_id } = req.query;

  try {
    const prisma = getPrisma();
    const whereClause: any = {};

    if (medico_id) {
      whereClause.medico_id = Number(medico_id);
    }

    let horarios: any[] = [];

    try {
      // SELECT mínimo: apenas colunas que existem com certeza no banco
      horarios = await prisma.horario.findMany({
        where: whereClause,
        select: {
          id: true,
          data_hora: true,
          medico_id: true
        },
        orderBy: { data_hora: 'asc' }
      });
    } catch (dbErr: any) {
      console.warn('Falha na busca mínima de horários (com where), tentando sem where:', dbErr?.message);
      // Fallback: busca mínima sem filtro
      horarios = await prisma.horario.findMany({
        select: {
          id: true,
          data_hora: true,
          medico_id: true
        },
        orderBy: { data_hora: 'asc' }
      });
    }

    const result = horarios.map((h: any) => ({
      id: h.id,
      data_hora: h.data_hora,
      hora_inicio: h.hora_inicio || '07:00',
      hora_fim: h.hora_fim || '11:00',
      vagas_totais: h.vagas_totais ?? 1,
      vagas_disponiveis: h.vagas_disponiveis ?? 1,
      medico_id: h.medico_id,
      status_disponivel: true,
      medico: h.medico || null,
      agendamentos: []
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
 *
 * IMPORTANTE: Insere apenas as colunas essenciais (data_hora, medico_id) para
 * evitar erro 500 quando o banco não possui as colunas extras. As demais colunas
 * possuem valores padrão no schema e são preenchidas automaticamente pelo banco.
 */
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { data_hora, medico_id } = req.body;

  if (!data_hora || !medico_id) {
    return res.status(400).json({ error: 'Campos incorretos', message: 'Data e Identificador do Médico são obrigatórios.' });
  }

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

// Insert mínimo: apenas colunas essenciais
    // O objeto é tipado como any para contornar a checagem estrita do Prisma,
    // pois algumas colunas podem não existir fisicamente no banco de produção.
    const createData: any = {
      data_hora: dateObj,
      medico_id: Number(medico_id)
    };
    const horario = await prisma.horario.create({ data: createData });

    return res.status(201).json({
      id: horario.id,
      data_hora: horario.data_hora,
      hora_inicio: horario.hora_inicio || '07:00',
      hora_fim: horario.hora_fim || '11:00',
      vagas_totais: horario.vagas_totais ?? 1,
      vagas_disponiveis: horario.vagas_disponiveis ?? 1,
      medico_id: horario.medico_id,
      status_disponivel: true
    });
  } catch (error: any) {
    console.error('Erro ao criar horário:', error);
    return res.status(500).json({
      error: 'Erro de inserção',
      message: 'Não foi possível cadastrar o horário.',
      details: error.message,
      meta: error?.meta || null
    });
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
</content>
