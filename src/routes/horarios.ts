import { Router, Request, Response } from 'express';
import { getPrisma } from '../db/prisma.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware.js';

const router = Router();

/**
 * GET /api/horarios
 * Público: Lista horários/turnos disponíveis ou filtrados por médico
 */
router.get('/', async (req: Request, res: Response) => {
  const { medico_id, apenas_disponiveis } = req.query;

  try {
    const prisma = getPrisma();
    const whereClause: any = {};

    if (medico_id) {
      whereClause.medico_id = Number(medico_id);
    }

    if (apenas_disponiveis === 'true') {
      whereClause.status_disponivel = true;
    }

    let horarios: any[] = [];
    try {
      horarios = await prisma.horario.findMany({
        where: whereClause,
        include: {
          medico: { select: { id: true, nome: true, especialidade: true } },
          agendamentos: { select: { id: true, nome_paciente: true, telefone: true } }
        },
        orderBy: { data_hora: 'asc' }
      });
    } catch (dbErr: any) {
      const legacyHorarios = await prisma.horario.findMany({
        where: whereClause,
        include: {
          medico: { select: { id: true, nome: true, especialidade: true } }
        },
        orderBy: { data_hora: 'asc' }
      });

      horarios = legacyHorarios.map((h: any) => ({
        ...h,
        hora_inicio: h.hora_inicio || '07:00',
        hora_fim: h.hora_fim || '11:00',
        vagas_totais: h.vagas_totais ?? 1,
        vagas_disponiveis: h.vagas_disponiveis ?? (h.status_disponivel ? 1 : 0),
        agendamentos: h.agendamentos || []
      }));
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

    let lastError: any = null;
    let horario: any = null;

    try {
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
      lastError = createErr;
      console.warn('Falha no insert completo do horário, tentando fallback compatível com o schema do banco:', createErr?.message);

      try {
        const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'Horarios'
        `;

        const availableColumns = new Set(columns.map((column) => column.column_name.toLowerCase()));
        const insertColumns: string[] = [];
        const values: any[] = [];
        const placeholders: string[] = [];

        const addColumn = (columnName: string, value: any) => {
          if (availableColumns.has(columnName.toLowerCase())) {
            insertColumns.push(`"${columnName}"`);
            values.push(value);
            placeholders.push(`$${values.length}`);
          }
        };

        addColumn('data_hora', dateObj);
        addColumn('hora_inicio', hora_inicio || '07:00');
        addColumn('hora_fim', hora_fim || '11:00');
        addColumn('vagas_totais', numVagas);
        addColumn('vagas_disponiveis', numVagas);
        addColumn('medico_id', Number(medico_id));
        addColumn('status_disponivel', true);

        if (insertColumns.length === 0) {
          throw new Error('A tabela Horarios não possui colunas válidas para criação.');
        }

        const insertSql = `
          INSERT INTO "Horarios" (${insertColumns.join(', ')})
          VALUES (${placeholders.join(', ')})
          RETURNING id, data_hora, medico_id, hora_inicio, hora_fim, vagas_totais, vagas_disponiveis, status_disponivel
        `;

        const rows = await prisma.$queryRawUnsafe(insertSql, ...values) as Array<any>;
        horario = rows[0] ?? null;
      } catch (fallbackErr: any) {
        lastError = fallbackErr;
        console.error('Falha no fallback compatível de inserção de horário:', fallbackErr?.message);
        throw fallbackErr;
      }
    }

    if (!horario) {
      throw lastError || new Error('Não foi possível criar o horário.');
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
