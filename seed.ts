import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 1. Seed de Admin
  const email = 'lunamendes@clinica.com';
  const password = 'lunamendes123456789';

  const existingAdmin = await prisma.adminUser.findUnique({
    where: { email }
  });

  if (!existingAdmin) {
    const password_hash = await bcrypt.hash(password, 10);
    await prisma.adminUser.create({
      data: {
        email,
        password_hash
      }
    });
    console.log(`[Seed] Admin ${email} criado com sucesso!`);
  } else {
    console.log(`[Seed] Admin ${email} já existe.`);
  }

  // 2. Seed de Check-ups
  const checkups = [
    {
      nome: 'Check-up Completo',
      preco: 'R$ 169,99',
      descricao: JSON.stringify({
        subtitle: 'Mais saúde e tranquilidade para sua viagem ou rotina',
        tag: 'Mais Procurado',
        exams: [
          'Hemograma Completo',
          'Ácido Úrico',
          'Vitamina D',
          'Creatinina',
          'Glicose',
          'Ureia',
          'Triglicerídeos',
          'Colesterol Total',
          'TGO / TGP',
          'TSH & T4 Livre',
          'LDL / VLDL / HDL'
        ]
      }),
      instrucoes_preparo: 'Jejum obrigatório de 8 a 12 horas. Não ingerir bebida alcoólica 72 horas antes.'
    },
    {
      nome: 'Check-up Feminino',
      preco: 'R$ 165,99',
      descricao: JSON.stringify({
        subtitle: 'Prevenção e acompanhamento completo de saúde da mulher',
        tag: 'Essencial Mulher',
        exams: [
          'Citologia (Preventivo)',
          'Tireoide (TSH e T4 Livre)',
          'Vitamina D',
          'Hemograma Completo',
          'Glicose em Jejum',
          'Eletrólitos (Sódio e Potássio)',
          'Sumário de Urina',
          'Colesterol Total e Frações',
          'Triglicerídeos completos'
        ]
      }),
      instrucoes_preparo: 'Jejum de 8 a 12 horas. Abstinência sexual de 48 horas para o preventivo.'
    },
    {
      nome: 'Check-up Infantil',
      preco: 'R$ 90,90',
      descricao: JSON.stringify({
        subtitle: 'Acompanhamento do desenvolvimento e exames fundamentais',
        tag: 'Pediátrico',
        exams: [
          'Hemograma Completo',
          'Hemoglobina Glicada',
          'Ferro Sérico',
          'Colesterol Total',
          'Colesterol HDL / LDL',
          'Colesterol VLDL',
          'Sódio e Potássio',
          'Sumário de Urina',
          'Parasitológico de Fezes'
        ]
      }),
      instrucoes_preparo: 'Jejum mínimo de 4 horas para menores de 5 anos. Levar amostra de fezes.'
    },
    {
      nome: 'Check-up Masculino',
      preco: 'R$ 135,90',
      descricao: JSON.stringify({
        subtitle: 'Prevenção e acompanhamento completo de saúde do homem',
        tag: 'Masculino',
        exams: [
          'PSA Total',
          'PSA Livre',
          'Hemograma Completo',
          'Homoglobina Glicada',
          'Creatinina',
          'Ureia',
          'Colesterol Total',
          'Colesterol HDL',
          'Colesterol LDL',
          'Colesterol VLDL',
          'Triglicerídeos',
          'Sódio',
          'Potássio',
          'Sumário de Urina'
        ]
      }),
      instrucoes_preparo: 'Jejum de 8 a 12 horas. Para o PSA, abstinência sexual e não andar de bicicleta por 48 horas.'
    },
    {
      nome: 'Check-up Pré/Pós Festas',
      preco: 'R$ 149,99',
      descricao: JSON.stringify({
        subtitle: 'Avaliação clínica geral e exames de infecção essenciais',
        tag: 'Foco Geral',
        exams: [
          'Hemograma',
          'Glicose',
          'Ureia e Creatinina',
          'TGO / TGP (Função Hepática)',
          'Exame de Urina (EAS)',
          'Hepatite B e C',
          'HIV',
          'Sífilis'
        ]
      }),
      instrucoes_preparo: 'Jejum de 8 horas.'
    }
  ];

  for (const item of checkups) {
    const existing = await prisma.checkup.findFirst({
      where: { nome: item.nome }
    });
    if (!existing) {
      await prisma.checkup.create({
        data: item
      });
      console.log(`[Seed] Checkup ${item.nome} criado.`);
    } else {
      console.log(`[Seed] Checkup ${item.nome} já existe.`);
    }
  }

  // 3. Seed de Exames de Imagem
  const examesImagem = [
    {
      nome: 'Ultrassonografia Abdominal Total',
      preco: 150.00,
      descricao: 'Avaliação detalhada do fígado, vesícula biliar, vias biliares, baço, pâncreas, rins e aorta.',
      instrucoes_preparo: 'Jejum absoluto de 6 a 8 horas. Tomar 4 copos de água 1 hora antes do exame e não urinar.'
    },
    {
      nome: 'Ultrassonografia de Tireoide',
      preco: 120.00,
      descricao: 'Análise morfológica da glândula tireoide e linfonodos cervicais.',
      instrucoes_preparo: 'Não requer preparo prévio. Trazer exames anteriores se houver.'
    },
    {
      nome: 'Ultrassonografia Mamária',
      preco: 140.00,
      descricao: 'Avaliação do tecido mamário e axilas.',
      instrucoes_preparo: 'Não usar desodorante, talco ou cremes na região das mamas e axilas no dia do exame.'
    },
    {
      nome: 'Ultrassonografia Obstétrica',
      preco: 130.00,
      descricao: 'Acompanhamento do desenvolvimento fetal, placenta e líquido amniótico.',
      instrucoes_preparo: 'Até 12 semanas de gestação: tomar 3 a 4 copos de água 1 hora antes. Após 12 semanas: não necessita preparo.'
    },
    {
      nome: 'Ecocardiograma Transtorácico',
      preco: 220.00,
      descricao: 'Avaliação da estrutura e função cardíaca com Doppler colorido.',
      instrucoes_preparo: 'Não necessita jejum. Comparecer com roupas confortáveis.'
    },
    {
      nome: 'Raio-X de Tórax (PA e Perfil)',
      preco: 90.00,
      descricao: 'Estudo radiográfico dos pulmões, coração, estruturas ósseas e diafragma.',
      instrucoes_preparo: 'Remover todos os objetos metálicos e bijuterias da região torácica.'
    },
    {
      nome: 'Raio-X da Coluna Lombo-Sacra',
      preco: 110.00,
      descricao: 'Estudo das vértebras lombares e osso sacro.',
      instrucoes_preparo: 'Não necessita preparo especial.'
    }
  ];

  for (const item of examesImagem) {
    const existing = await prisma.exameImagem.findFirst({
      where: { nome: item.nome }
    });
    if (!existing) {
      await prisma.exameImagem.create({ data: item });
      console.log(`[Seed] Exame de Imagem ${item.nome} criado.`);
    } else {
      console.log(`[Seed] Exame de Imagem ${item.nome} já existe.`);
    }
  }

  // 4. Seed de Exames Laboratoriais
  const examesLaboratoriais = [
    {
      nome: 'Hemograma Completo',
      preco: 35.00,
      descricao: 'Avaliação das células sanguíneas (hemácias, leucócitos e plaquetas).',
      instrucoes_preparo: 'Jejum recomendado de 4 a 8 horas.'
    },
    {
      nome: 'Glicemia em Jejum',
      preco: 20.00,
      descricao: 'Medição dos níveis de glicose no sangue.',
      instrucoes_preparo: 'Jejum obrigatório de 8 horas.'
    },
    {
      nome: 'Dosagem de Vitamina D (25-OH)',
      preco: 60.00,
      descricao: 'Avaliação dos níveis de vitamina D para saúde óssea e imunidade.',
      instrucoes_preparo: 'Jejum de 8 horas.'
    },
    {
      nome: 'Lipidograma Completo',
      preco: 45.00,
      descricao: 'Colesterol Total, HDL, LDL, VLDL e Triglicerídeos.',
      instrucoes_preparo: 'Jejum obrigatório de 12 horas. Evitar álcool nas 72h anteriores.'
    },
    {
      nome: 'Dosagem TSH e T4 Livre',
      preco: 55.00,
      descricao: 'Avaliação do funcionamento da tireoide.',
      instrucoes_preparo: 'Jejum de 8 horas. Coletar preferencialmente pela manhã.'
    }
  ];

  for (const item of examesLaboratoriais) {
    const existing = await prisma.exameLaboratorial.findFirst({
      where: { nome: item.nome }
    });
    if (!existing) {
      await prisma.exameLaboratorial.create({ data: item });
      console.log(`[Seed] Exame Laboratorial ${item.nome} criado.`);
    } else {
      console.log(`[Seed] Exame Laboratorial ${item.nome} já existe.`);
    }
  }

}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
