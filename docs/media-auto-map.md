# Mapa dos nomes automáticos do Flow → slug (proposta)

Os 38 arquivos com nome automático do lote 1–3 (`Man_performing_…`,
`Woman_demonstrating_…`) foram descartados no import e estão só no histórico do git
(commit `08620ce`). Esta é a proposta de slug para cada um. Nada foi importado ainda.

Um quadro de cada: [`screenshots/media/auto-names.jpg`](screenshots/media/auto-names.jpg).
O código A01…A38 é o rótulo de cada quadro nessa imagem.

**Regra:** só mapeei quando o nome e o movimento batem com um exercício do seed.
Na dúvida, não mapeei; esses ficam para o Moacir refazer. Os que você aprovar passam
pelo mesmo import e pelo mesmo QC quadro a quadro. Um mapeamento aprovado ainda pode
cair como suspeito no QC.

## Proposta: mapear (10 vídeos)

Quando há duas cópias do mesmo vídeo, fica a mais nova. As duas são iguais no quadro.

| # | arquivo | slug proposto | sexo | confiança | observação |
|---|---|---|---|---|---|
| A08 | Man_performing_doorframe_biceps_…_20260929175529.mp4 | doorframe_curl | m | alta | inclina para trás segurando o batente e puxa o corpo; A07 é a cópia mais velha |
| A31 | Woman_performing_doorframe_bicep…_20260929051630.mp4 | doorframe_curl | f | alta | mesmo movimento |
| A17 | Man_performing_supported_split_s…_20260929051717.mp4 | supported_split_squat | m | alta | apoio na cadeira; atenção no QC: desce bastante (o texto diz "desça um pouco") |
| A37 | Woman_performing_supported_split…_20260929175524.mp4 | supported_split_squat | f | alta | apoio na cadeira; A36 é a cópia mais velha |
| A18 | Man_performing_towel_foot_curl_20260929051625.mp4 | towel_curl | m | alta | sentado, toalha sob o pé, puxa com os braços |
| A38 | Woman_performing_towel_foot_curl_20260929051625.mp4 | towel_curl | f | alta | idem |
| A06 | Man_performing_biceps_curl_20260929175520.mp4 | self_resisted_curl | m | média | em pé, uma mão segura o punho da outra; A05 é a cópia mais velha |
| A30 | Woman_performing_biceps_curl_20260929175520.mp4 | self_resisted_curl | f | média | idem; A29 é a cópia mais velha |
| A13 | Man_performing_seated_leg_lift_20260929051628.mp4 | su_seated_leg_lift_curl | m | média | sentado, perna erguida; no QC vou conferir se as mãos ficam sob a coxa |
| A35 | Woman_performing_seated_leg-lift…_20260929051625.mp4 | su_seated_leg_lift_curl | f | média | idem; a perna quase não aparece subindo |

## Não mapear (28 arquivos)

| # | arquivo | por quê |
|---|---|---|
| A05, A07, A29, A36 | cópias mais velhas dos vídeos acima | duplicadas |
| A10 | Man_performing_low_step-up (vídeo) | serve para `low_step_up` (que já tem .m ok) ou para `rx_low_step_up`; ambíguo |
| A11, A33, A34 | reverse_curl (vídeos, em pé) | o único reverse curl sem equipamento do seed (`su_seated_reverse_self_curl`) é **sentado** |
| A15, A16, A32 | self-resisted hammer / hammer curl (vídeos, em pé) | `su_seated_hammer_self_curl` é **sentado** |
| A28 | Woman_performing_abdominal_crunch (vídeo) | `crunch.f` já está ok no app |
| A01–A04, A09, A12, A14, A19–A27 | 16 imagens `.jpg`, sem vídeo | imagem sozinha não vira demo; vários já têm clipe (bodyweight_squat, seated_side_bend, standing_oblique_crunch, rx_high_box_squat, sl_seated_knee_reach_crunch) |

Se aprovar os 10, os exercícios `doorframe_curl`, `supported_split_squat`,
`towel_curl`, `self_resisted_curl` e `su_seated_leg_lift_curl`, que hoje estão na lista de
refazer como "só imagem", podem passar a ter mulher e homem (se passarem no QC).
