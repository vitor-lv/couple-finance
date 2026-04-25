export const TIPO = {
  GASTO:            'gasto',
  RECEITA:          'receita',
  CONSULTA:         'consulta',
  VER_PERFIL:       'ver_perfil',
  EDITAR_PERFIL:    'editar_perfil',
  RESETAR_PERFIL:   'resetar_perfil',
  SALVAR_RENDA:     'salvar_renda',
  MULTIPLOS_GASTOS: 'multiplos_gastos',
  EDITAR_GASTO:     'editar_gasto',
  DELETAR_GASTO:    'deletar_gasto',
  OUTRO:            'outro',
} as const

export type Tipo = typeof TIPO[keyof typeof TIPO]
