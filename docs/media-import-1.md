Daniel aqui. Tarefa de mídia (pode fazer AGORA, em paralelo à Fase 26, em commits separados "Media: …"). Já subi no GitHub, na branch claude/sweet-ride-3drey3, pasta assets/prototype/, TODOS os vídeos e imagens que o Moacir gerou no Google Flow (3 commits "Add files via upload", ~397 arquivos, ~330 MB). São os arquivos CRUS baixados do Flow — não estão prontos. Sua tarefa: limpar, padronizar, ligar no app e testar. Salve este texto em docs/media-import-1.md.

## Como os arquivos chegaram
- Nome = título no Flow + carimbo de data: `<slug>.<f|m>_<AAAAMMDDhhmmss>.mp4` (vídeo) e `<slug>.<f|m>_<carimbo>.jpg` (imagem de partida do mesmo exercício). f = mulher, m = homem.
- Há o mesmo arquivo repetido com carimbos diferentes (baixei o projeto do Flow mais de uma vez).
- Lixo que NÃO entra no app: tudo que começa com `x_bad_` (versões ruins/refeitas, 24 arquivos), `body-adult-*` (referências), e os ~49 arquivos com nome automático do Flow (`Man_performing_…`, `Woman_demonstrating_…`, `Man_lying…`) — são sobras sem nome confiável.

## O que fazer
1. Script `scripts/import-flow-media.mjs` (commitado, reutilizável nos próximos lotes):
   - Lê assets/prototype/, aceita só `^([a-z0-9_]+)\.(f|m)_(\d{14})\.(mp4|jpg)$`.
   - Para cada slug+sexo+tipo fica com o de carimbo MAIS NOVO (os refeitos são sempre mais novos).
   - Ignora/remove `x_bad_*`, `body-adult-*` e os nomes automáticos (listar no relatório o que foi descartado).
   - Slug que não existe em supabase/seed/exercises.json nem em repair_tests.json: não inventar; listar no relatório (pode ser nome de seed diferente — sugerir o slug certo se for óbvio).
2. Vídeo final `assets/prototype/<slug>.<f|m>.mp4`: reencodar com ffmpeg (instale se não tiver): H.264, CRF 26, 720×1280 (manter 9:16), sem áudio (`-an`), `-movflags +faststart`, 24–30 fps. Alvo < 1 MB por clipe.
3. Pôster/miniatura `assets/prototype/posters/<slug>.<f|m>.webp`: a partir do .jpg (a imagem de partida), 480 px de largura, qualidade ~70, alvo < 60 KB. Usar como `poster` do vídeo (aparece enquanto carrega e no card do exercício), mesma regra de sexo do vídeo (nunca mostrar o outro sexo).
4. Apagar do repositório os arquivos crus (depois de processados). Sem reescrever histórico, sem force-push. Adicionar regra no .gitignore/README de assets/prototype explicando que só entram `<slug>.<f|m>.mp4` e `posters/`.
5. `npm run prototype:videos` → videos.js atualizado (incluir o pôster no manifesto). `npm run bundle:check` tem que continuar bloqueando os vídeos e pôsteres na versão de loja (só dev, SPEC §6).
6. Testar no app (build de dev): abrir 10 exercícios variados (sentado, chão, em pé, um de cada lote), perfil mulher e perfil homem, 60+ e adolescente — confere que aparece o clipe do sexo certo, o "Outro lado" espelha nos unilaterais, o pôster aparece antes do play, e que exercício sem clipe mostra o quadro "demo em breve". Prints no relatório.

## Controle de qualidade (QC) — importante
Os lotes 2 e 3 ainda NÃO foram conferidos quadro a quadro. Para cada vídeo novo gere uma tira de 6 quadros (ffmpeg, 1 a cada ~1,3 s) e olhe. Marque como SUSPEITO (não apagar; só listar e manter fora do videos.js) se:
- pessoa diferente da imagem de partida, sexo trocado, pessoa extra, membro a mais/faltando, rosto derretendo;
- movimento errado para o nome do exercício (ex.: "hold" que se mexe muito, flexão de joelho com quadril empinado, "sentado" que levanta da cadeira);
- câmera mexendo muito, texto/logo na tela.
Já sei que merecem atenção: seated_towel_press_up (toalha frouxa), downward_palm_press_hold.m (braços estendidos), sl_supported_hip_hinge.m (começa inclinado), knee_push_up f/m, bal_seated_knee_lift_hold f/m (joelho pode não subir), bal_sit_to_stand_hold e bal_supported_heel_toe_walk (movimento longo em 8 s).
No relatório: tabela slug | f | m | status (ok / suspeito + motivo / faltando). O Moacir refaz no Flow os suspeitos e os faltantes.

## Relatório
Em português: quantos exercícios ficaram com f+m, só um sexo, faltando; tamanho total antes/depois; lista de descartados; tabela de QC; prints; perguntas (no máximo 3, opção recomendada primeiro).
