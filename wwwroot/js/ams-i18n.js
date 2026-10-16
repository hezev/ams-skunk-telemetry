(function(){
'use strict';
const KEY='ams.language';
const dict={
'Dashboard':['Painel principal','Dashboard'],'Live Pitwall':['Muro de boxes ao vivo','Live Pitwall'],'Telemetry':['Telemetria','Telemetry'],'Sessions':['Sessões','Sessions'],'Laps':['Voltas','Laps'],'Compare':['Comparar','Compare'],'Engineer':['Engenheiro','Engineer'],'Records':['Recordes','Records'],'Driver':['Piloto','Driver'],'Team':['Equipa','Team'],'Workspace':['Área de trabalho','Workspace'],
'Login Piloto':['Entrar como piloto','Pilot login'],'Sair':['Sair','Log out'],'Entrar':['Entrar','Sign in'],'Criar conta':['Criar conta','Create account'],'Email':['Email','Email'],'Password':['Palavra-passe','Password'],'Entrar na telemetria':['Entrar na telemetria','Sign in to telemetry'],'Fechar':['Fechar','Close'],
'Sem sessão live':['Sem sessão em direto','No live session'],'Sem volta selecionada':['Nenhuma volta selecionada','No lap selected'],'A localizar traçado…':['A localizar circuito…','Locating track…'],'SEM DADOS LIVE':['SEM DADOS EM DIRETO','NO LIVE DATA'],'OFFLINE':['DESLIGADO','OFFLINE'],'ONLINE':['LIGADO','ONLINE'],
'Best Lap':['Melhor volta','Best lap'],'Last Lap':['Última volta','Last lap'],'Position':['Posição','Position'],'Class':['Classe','Class'],'Fuel':['Combustível','Fuel'],'Est. Laps':['Voltas estimadas','Estimated laps'],'Track Position':['Posição na pista','Track position'],
'Track':['Pista','Track'],'Timing':['Tempos','Timing'],'Speed':['Velocidade','Speed'],'Throttle':['Acelerador','Throttle'],'Brake':['Travão','Brake'],'Steering':['Direção','Steering'],'Gear':['Mudança','Gear'],'RPM':['RPM','RPM'],'Delta':['Delta','Delta'],
'Race Control Command Center':['Centro de controlo de corrida','Race control command center'],'▶ Replay volta':['▶ Reproduzir volta','▶ Replay lap'],'SESSION / REPLAY':['SESSÃO / REPLAY','SESSION / REPLAY'],
'Dados reais do AMS Telemetry · seleciona uma volta ou inicia um replay':['Dados reais do AMS Telemetry · seleciona uma volta ou inicia um replay','Real AMS Telemetry data · select a lap or start a replay'],
'Workspace persistente no browser para a volta selecionada':['Área de trabalho persistente no navegador para a volta selecionada','Persistent browser workspace for the selected lap'],
'Entra com a tua conta AMS. Contas de treinador autorizadas têm acesso global aos pilotos e telemetria.':['Entra com a tua conta AMS. Contas de treinador autorizadas têm acesso global aos pilotos e telemetria.','Sign in with your AMS account. Authorized coach accounts can access all drivers and telemetry.'],
'Volta':['Volta','Lap'],'Voltas':['Voltas','Laps'],'Setores':['Setores','Sectors'],'Mini setores':['Minissetores','Mini sectors'],'Comparação de voltas':['Comparação de voltas','Lap comparison'],'Selecionar volta':['Selecionar volta','Select lap'],
'Loading':['A carregar','Loading'],'Sem dados':['Sem dados','No data'],'Sem dados disponíveis':['Sem dados disponíveis','No data available'],'A carregar…':['A carregar…','Loading…'],'Erro ao carregar':['Erro ao carregar','Failed to load'],
'Trajetória':['Trajetória','Trajectory'],'Ganho / Perda':['Ganho / Perda','Gain / Loss'],'Cumulative Delta':['Delta acumulado','Cumulative delta'],'Virtual Sectors':['Setores virtuais','Virtual sectors'],'Mini Sectors':['Minissetores','Mini sectors'],'Trajectory Coach':['Treinador de trajetória','Trajectory coach'],
'Lap Record':['Recorde de volta','Lap record'],'Session':['Sessão','Session'],'Car':['Carro','Car'],'Circuit':['Circuito','Circuit'],'Search':['Pesquisar','Search'],'Refresh':['Atualizar','Refresh'],'Save':['Guardar','Save'],'Cancel':['Cancelar','Cancel'],'Apply':['Aplicar','Apply'],'Reset':['Repor','Reset'],'Export':['Exportar','Export'],'Import':['Importar','Import'],
'Zoom in':['Ampliar','Zoom in'],'Zoom out':['Reduzir','Zoom out'],'Fullscreen':['Ecrã inteiro','Fullscreen'],'Close':['Fechar','Close']
};
Object.assign(dict,{
"Select session":["Selecionar sessão","Select session"],
"Select lap":["Selecionar volta","Select lap"],
"Choose lap":["Escolher volta","Choose lap"],
"No sessions found":["Nenhuma sessão encontrada","No sessions found"],
"No laps found":["Nenhuma volta encontrada","No laps found"],
"No telemetry data":["Sem dados de telemetria","No telemetry data"],
"No lap selected":["Nenhuma volta selecionada","No lap selected"],
"No live session":["Sem sessão em direto","No live session"],
"Connecting...":["A ligar...","Connecting..."],
"Connected":["Ligado","Connected"],
"Disconnected":["Desligado","Disconnected"],
"Connection error":["Erro de ligação","Connection error"],
"Retry":["Tentar novamente","Retry"],
"Loading sessions...":["A carregar sessões...","Loading sessions..."],
"Loading laps...":["A carregar voltas...","Loading laps..."],
"Lap Compare":["Comparação de voltas","Lap Compare"],
"Compare Laps":["Comparar voltas","Compare Laps"],
"Reference lap":["Volta de referência","Reference lap"],
"Comparison lap":["Volta de comparação","Comparison lap"],
"Lap A":["Volta A","Lap A"],
"Lap B":["Volta B","Lap B"],
"Time delta":["Diferença de tempo","Time delta"],
"Cumulative delta":["Delta acumulado","Cumulative delta"],
"Gain / Loss":["Ganho / Perda","Gain / Loss"],
"Gain/Loss":["Ganho/Perda","Gain/Loss"],
"Brake points":["Pontos de travagem","Brake points"],
"Acceleration points":["Pontos de aceleração","Acceleration points"],
"Sector Analysis":["Análise por setores","Sector Analysis"],
"Sectors":["Setores","Sectors"],
"Mini sectors":["Minissetores","Mini sectors"],
"Virtual sectors":["Setores virtuais","Virtual sectors"],
"Track Map":["Mapa da pista","Track Map"],
"Track map":["Mapa da pista","Track map"],
"Track layout":["Traçado da pista","Track layout"],
"Trajectory Compare":["Comparação de trajetórias","Trajectory Compare"],
"Trajectory Coach":["Treinador de trajetória","Trajectory Coach"],
"Brake":["Travão","Brake"],
"Throttle":["Acelerador","Throttle"],
"Speed":["Velocidade","Speed"],
"Steering angle":["Ângulo de direção","Steering angle"],
"Gear":["Mudança","Gear"],
"Distance":["Distância","Distance"],
"Lap time":["Tempo por volta","Lap time"],
"Best lap":["Melhor volta","Best lap"],
"Last lap":["Última volta","Last lap"],
"Live":["Direto","Live"],
"Replay":["Reprodução","Replay"],
"Engineer Analysis":["Análise do engenheiro","Engineer Analysis"],
"Race Engineer":["Engenheiro de corrida","Race Engineer"],
"Virtual Race Engineer":["Engenheiro virtual de corrida","Virtual Race Engineer"],
"Driver Feedback":["Feedback ao piloto","Driver Feedback"],
"Key Insights":["Principais conclusões","Key Insights"],
"Consistency":["Consistência","Consistency"],
"Performance":["Desempenho","Performance"],
"Recommendations":["Recomendações","Recommendations"],
"Braking":["Travagem","Braking"],
"Acceleration":["Aceleração","Acceleration"],
"Corner entry":["Entrada de curva","Corner entry"],
"Corner exit":["Saída de curva","Corner exit"],
"Minimum speed":["Velocidade mínima","Minimum speed"],
"Lap Records":["Recordes de volta","Lap Records"],
"Lap Record":["Recorde de volta","Lap Record"],
"Personal Best":["Recorde pessoal","Personal Best"],
"Fastest Lap":["Volta mais rápida","Fastest Lap"],
"Rankings":["Classificações","Rankings"],
"Progression":["Progressão","Progression"],
"Career":["Carreira","Career"],
"Driver name":["Nome do piloto","Driver name"],
"Track":["Pista","Track"],
"Timing":["Tempos","Timing"],
"Session":["Sessão","Session"],
"Session time":["Tempo de sessão","Session time"],
"Session Type":["Tipo de sessão","Session Type"],
"Track Temperature":["Temperatura da pista","Track Temperature"],
"Air Temperature":["Temperatura do ar","Air Temperature"],
"Tyre Temperatures":["Temperaturas dos pneus","Tyre Temperatures"],
"Tyre Pressures":["Pressões dos pneus","Tyre Pressures"],
"Fuel Consumption":["Consumo de combustível","Fuel Consumption"],
"Fuel":["Combustível","Fuel"],
"Overall position":["Posição geral","Overall position"],
"Class position":["Posição na classe","Class position"],
"Car":["Carro","Car"],
"Pilot":["Piloto","Pilot"],
"Coach":["Treinador","Coach"],
"Account":["Conta","Account"],
"Settings":["Definições","Settings"],
"Language":["Idioma","Language"],
"Portuguese":["Português","Portuguese"],
"English":["Inglês","English"],
"Show":["Mostrar","Show"],
"Hide":["Ocultar","Hide"],
"Expand":["Ampliar","Expand"],
"Collapse":["Reduzir","Collapse"],
"Reset zoom":["Repor zoom","Reset zoom"],
"Download":["Descarregar","Download"],
"Upload":["Carregar","Upload"],
"Filter":["Filtrar","Filter"],
"Clear":["Limpar","Clear"],
"All":["Todos","All"],
"Date":["Data","Date"],
"Status":["Estado","Status"],
"Save changes":["Guardar alterações","Save changes"]
});
Object.assign(dict,{
"Live Track Map":["Mapa da corrida em direto","Live Track Map"],
"Race Time":["Tempo de corrida","Race Time"],
"Leader Gap":["Diferença para o líder","Leader Gap"],
"Cars":["Carros","Cars"],
"Flag":["Bandeira","Flag"],
"Pos":["Pos.","Pos"],
"Cls":["Classe","Cls"],
"Last":["Última","Last"],
"Best":["Melhor","Best"],
"Gap":["Diferença","Gap"],
"Stint":["Stint","Stint"],
"▶ Simular com volta gravada":["▶ Simular com volta gravada","▶ Simulate from recorded lap"],
"Timing live quando disponível; replay de uma volta gravada para validação do painel":["Tempos em direto quando disponíveis; reprodução de uma volta gravada para validar o painel","Live timing when available; replay a recorded lap to validate the display"],
"A carregar mapa da pista…":["A carregar mapa da pista…","Loading track map…"],
"SUPABASE LIVE":["SUPABASE EM DIRETO","SUPABASE LIVE"],
"SEM LIVE CLOUD":["SEM DADOS EM DIRETO","NO LIVE DATA"],
"LIVE CLOUD NÃO CONFIGURADO":["LIVE CLOUD NÃO CONFIGURADO","LIVE CLOUD NOT CONFIGURED"]
});
Object.assign(dict,{
"LOGIN / SUPABASE":["ENTRAR / SUPABASE","LOGIN / SUPABASE"],
"Piloto":["Piloto","Driver"],
"Average":["Média","Average"],
"Target":["Objetivo","Target"],
"Window":["Janela","Window"],
"Live Pitwall":["Muro de boxes em direto","Live Pitwall"],
"Análise detalhada da telemetria gravada pelo AMS Telemetry v5.12.17":["Análise detalhada da telemetria gravada pelo AMS Telemetry v5.12.17","Detailed analysis of telemetry recorded by AMS Telemetry v5.12.17"],
"Referência":["Referência","Reference"],
"SEM VOLTA":["SEM VOLTA","NO LAP"],
"Replay / Seek":["Reprodução / Posição","Replay / Seek"],
"Lap Time":["Tempo de volta","Lap Time"],
"Max Speed":["Velocidade máxima","Max Speed"],
"Reference":["Referência","Reference"],
"Fuel Used":["Combustível utilizado","Fuel Used"],
"Peak G":["Pico de força G","Peak G"],
"Lap Delta":["Delta da volta","Lap Delta"],
"Histórico de corridas, treinos e qualificações":["Histórico de corridas, treinos e qualificações","Race, practice and qualifying history"],
"Date":["Data","Date"],
"Simulator":["Simulador","Simulator"],
"Laps":["Voltas","Laps"],
"Status":["Estado","Status"],
"Voltas reais gravadas no AMS Telemetry":["Voltas reais gravadas no AMS Telemetry","Real laps recorded by AMS Telemetry"],
"Time":["Tempo","Time"],
"Circuit":["Circuito","Circuit"],
"Lap Compare &amp; Corner Explorer":["Comparação de voltas e análise de curvas","Lap Compare & Corner Explorer"],
"Comparação sincronizada de trajectória e telemetria por posição de pista":["Comparação sincronizada de trajetória e telemetria por posição na pista","Synchronized trajectory and telemetry comparison by track position"],
"Comparar":["Comparar","Compare"],
"Seleciona duas voltas":["Seleciona duas voltas","Select two laps"],
"Position A / Ref":["Posição A / Ref.","Position A / Ref"],
"Separation":["Separação","Separation"],
"Zoom":["Ampliação","Zoom"],
"Difference":["Diferença","Difference"],
"Compatibility":["Compatibilidade","Compatibility"],
"Session Intelligence &amp; AI Engineer":["Análise de sessão e Engenheiro IA","Session Intelligence & AI Engineer"],
"Análise pós-sessão · consistência, potencial e evidência DRIVER / SETUP":["Análise pós-sessão · consistência, potencial e evidência PILOTO / SETUP","Post-session analysis · consistency, potential and DRIVER / SETUP evidence"],
"Analyse Session":["Analisar sessão","Analyse Session"],
"Seleciona uma sessão":["Seleciona uma sessão","Select a session"],
"BIGGEST GAIN":["MAIOR GANHO","BIGGEST GAIN"],
"MAIN LOSS AREA":["PRINCIPAL ZONA DE PERDA","MAIN LOSS AREA"],
"BRAKING CONSISTENCY":["CONSISTÊNCIA DA TRAVAGEM","BRAKING CONSISTENCY"],
"THROTTLE CONFIDENCE":["CONFIANÇA NO ACELERADOR","THROTTLE CONFIDENCE"],
"TRAFFIC EFFECT":["EFEITO DO TRÁFEGO","TRAFFIC EFFECT"],
"RECOMMENDED FOCUS":["FOCO RECOMENDADO","RECOMMENDED FOCUS"],
"SEM TRAÇADO":["SEM TRAÇADO","NO TRACK MAP"],
"Seleciona e analisa uma sessão com mapa validado para visualizar o traçado.":["Seleciona e analisa uma sessão com mapa validado para visualizar o traçado.","Select and analyze a session with a validated map to view the track."],
"Menor":["Menor","Lower"],
"Intermédia":["Intermédia","Medium"],
"Maior":["Maior","Higher"],
"THIS SESSION":["ESTA SESSÃO","THIS SESSION"],
"EVIDENCE":["EVIDÊNCIA","EVIDENCE"],
"NEXT STINT":["PRÓXIMO STINT","NEXT STINT"],
"Driver influence":["Influência do piloto","Driver influence"],
"Setup influence":["Influência do setup","Setup influence"],
"Absolute theoretical":["Tempo teórico absoluto","Absolute theoretical"],
"Driver opportunity":["Potencial do piloto","Driver opportunity"],
"Potential setup gain":["Ganho potencial do setup","Potential setup gain"],
"Confidence":["Confiança","Confidence"],
"A estimativa de setup só é apresentada quando existem padrões repetíveis suficientes.":["A estimativa de setup só é apresentada quando existem padrões repetíveis suficientes.","Setup estimates are only shown when enough repeatable patterns are found."],
"AI READY":["IA PRONTA","AI READY"],
"Generate Briefing":["Gerar relatório","Generate Briefing"],
"Onde perco mais tempo?":["Onde perco mais tempo?","Where am I losing the most time?"],
"Melhorar travagem":["Melhorar travagem","Improve braking"],
"Próxima sessão":["Próxima sessão","Next session"],
"Ask Engineer":["Perguntar ao engenheiro","Ask Engineer"],
"Consistency":["Consistência","Consistency"],
"Lap variance σ":["Variação das voltas σ","Lap variance σ"],
"Zones analysed":["Zonas analisadas","Zones analysed"],
"Última volta válida":["Última volta válida","Last valid lap"],
"Melhor volta":["Melhor volta","Best lap"],
"Analisa uma sessão com pelo menos duas voltas completas para comparar os gráficos.":["Analisa uma sessão com pelo menos duas voltas completas para comparar os gráficos.","Analyze a session with at least two complete laps to compare the graphs."],
"Consistent Pace":["Ritmo consistente","Consistent Pace"],
"Achievable Lap":["Volta alcançável","Achievable Lap"],
"Zone":["Zona","Zone"],
"Median loss":["Perda mediana","Median loss"],
"Time σ":["Tempo σ","Time σ"],
"Brake σ":["Travão σ","Brake σ"],
"Throttle σ":["Acelerador σ","Throttle σ"],
"Min speed σ":["Vel. mínima σ","Min speed σ"],
"Diagnosis":["Diagnóstico","Diagnosis"],
"AMS Lap Records":["Recordes de volta AMS","AMS Lap Records"],
"Recorde absoluto por simulador, pista e carro · disponível para todos os pilotos autenticados":["Recorde absoluto por simulador, pista e carro · disponível para todos os pilotos autenticados","Absolute record by simulator, track and car · available to all authenticated drivers"],
"Procurar pista ou carro":["Procurar pista ou carro","Search track or car"],
"Simulador":["Simulador","Simulator"],
"Todos":["Todos","All"],
"Pista":["Pista","Track"],
"Carro":["Carro","Car"],
"Tempo recorde":["Tempo recorde","Record time"],
"Melhoria":["Melhoria","Improvement"],
"Tempo ganho":["Tempo ganho","Time gained"],
"Combinações":["Combinações","Combinations"],
"Ordenado por recordes absolutos, depois pistas distintas e voltas registadas.":["Ordenado por recordes absolutos, depois pistas distintas e voltas registadas.","Ordered by absolute records, then unique tracks and recorded laps."],
"Recordes":["Recordes","Records"],
"Pistas":["Pistas","Tracks"],
"Voltas":["Voltas","Laps"],
"Performance e evolução":["Desempenho e evolução","Performance and progression"],
"SESSÃO / REPLAY":["SESSÃO / REPLAY","SESSION / REPLAY"],
"Sem sessão live":["Sem sessão em direto","No live session"]
});
Object.assign(dict,{
  "Strategy": [
    "Estratégia",
    "Strategy"
  ],
  "Setup Lab": [
    "Laboratório de Setup",
    "Setup Lab"
  ],
  "Telemetry Platform": [
    "Plataforma de Telemetria",
    "Telemetry Platform"
  ],
  "live summary": [
    "resumo em direto",
    "live summary"
  ],
  "Live race positions on track": [
    "Posições dos pilotos em direto na pista",
    "Live race positions on track"
  ],
  "Language / Idioma": [
    "Idioma",
    "Language"
  ]
});
Object.assign(dict,{
  "Setup Sheet": [
    "Ficha de setup",
    "Setup Sheet"
  ],
  "Recommendation Engine": [
    "Motor de recomendações",
    "Recommendation Engine"
  ],
  "Tune Catalog": [
    "Catálogo de afinações",
    "Tune Catalog"
  ],
  "SIMULATED IMPACT": [
    "IMPACTO SIMULADO",
    "SIMULATED IMPACT"
  ],
  "AERODYNAMICS": [
    "AERODINÂMICA",
    "AERODYNAMICS"
  ],
  "BRAKES & TYRES": [
    "TRAVÕES E PNEUS",
    "BRAKES & TYRES"
  ],
  "SUSPENSION": [
    "SUSPENSÃO",
    "SUSPENSION"
  ],
  "Rear wing": [
    "Asa traseira",
    "Rear wing"
  ],
  "Brake bias": [
    "Repartição de travagem",
    "Brake bias"
  ],
  "Front pressure": [
    "Pressão dianteira",
    "Front pressure"
  ],
  "Rear pressure": [
    "Pressão traseira",
    "Rear pressure"
  ],
  "Front ride height": [
    "Altura dianteira",
    "Front ride height"
  ],
  "Rear ride height": [
    "Altura traseira",
    "Rear ride height"
  ],
  "Front ARB": [
    "Barra estabilizadora dianteira",
    "Front ARB"
  ],
  "Rear ARB": [
    "Barra estabilizadora traseira",
    "Rear ARB"
  ],
  "BASELINE VS CURRENT SETUP": [
    "REFERÊNCIA VS SETUP ATUAL",
    "BASELINE VS CURRENT SETUP"
  ],
  "GT3 Baseline": [
    "Referência GT3",
    "GT3 Baseline"
  ],
  "COMPARAÇÃO DE SNAPSHOTS REAIS": [
    "COMPARAÇÃO DE REGISTOS REAIS",
    "REAL SNAPSHOT COMPARISON"
  ],
  "Track-Specific": [
    "Específico da pista",
    "Track-Specific"
  ],
  "Driving Style": [
    "Estilo de condução",
    "Driving Style"
  ],
  "Conditions": [
    "Condições",
    "Conditions"
  ],
  "Race Strategy": [
    "Estratégia de corrida",
    "Race Strategy"
  ],
  "Lap time (est.)": [
    "Tempo de volta (est.)",
    "Lap time (est.)"
  ],
  "Top speed": [
    "Velocidade máxima",
    "Top speed"
  ],
  "Braking stability": [
    "Estabilidade na travagem",
    "Braking stability"
  ],
  "Rotation": [
    "Rotação",
    "Rotation"
  ],
  "Traction": [
    "Tração",
    "Traction"
  ],
  "Tyre wear": [
    "Desgaste dos pneus",
    "Tyre wear"
  ],
  "My Setups": [
    "Os meus setups",
    "My Setups"
  ],
  "Community": [
    "Comunidade",
    "Community"
  ],
  "AMS Official": [
    "Oficial AMS",
    "AMS Official"
  ],
  "Garagem Real · iRacing": [
    "Garagem Real · iRacing",
    "Real Garage · iRacing"
  ],
  "Importar CarSetup JSON": [
    "Importar CarSetup JSON",
    "Import CarSetup JSON"
  ],
  "Guardar setup": [
    "Guardar setup",
    "Save setup"
  ],
  "Exportar JSON": [
    "Exportar JSON",
    "Export JSON"
  ],
  "Importar JSON": [
    "Importar JSON",
    "Import JSON"
  ],
  "Editar layout": [
    "Editar layout",
    "Edit layout"
  ],
  "Live Car Data": [
    "Dados do carro em direto",
    "Live Car Data"
  ],
  "RPM + Shift RPM": [
    "RPM + RPM de mudança",
    "RPM + Shift RPM"
  ],
  "Steering Torque": [
    "Binário da direção",
    "Steering Torque"
  ],
  "Lateral / Longitudinal G": [
    "G lateral / longitudinal",
    "Lateral / Longitudinal G"
  ],
  "Fuel Use / Hour": [
    "Consumo de combustível / hora",
    "Fuel Use / Hour"
  ],
  "Tyre Temperatures FL / FR / RL / RR": [
    "Temperaturas pneus DD / DE / TD / TE",
    "Tyre Temperatures FL / FR / RL / RR"
  ],
  "Water / Oil / Track / Air Temperature": [
    "Temperatura água / óleo / pista / ar",
    "Water / Oil / Track / Air Temperature"
  ],
  "Yaw / Pitch / Roll Rates": [
    "Velocidades de guinada / arfagem / rolamento",
    "Yaw / Pitch / Roll Rates"
  ],
  "Brake Bias": [
    "Repartição de travagem",
    "Brake Bias"
  ],
  "TC / ABS": [
    "TC / ABS",
    "TC / ABS"
  ],
  "Clutch": [
    "Embraiagem",
    "Clutch"
  ],
  "Humidity / Wind": [
    "Humidade / Vento",
    "Humidity / Wind"
  ],
  "Oil Pressure / Voltage": [
    "Pressão de óleo / Tensão",
    "Oil Pressure / Voltage"
  ],
  "Gain / Loss Map": [
    "Mapa de ganho / perda",
    "Gain / Loss Map"
  ],
  "Cumulative Time Delta": [
    "Delta de tempo acumulado",
    "Cumulative Time Delta"
  ],
  "Virtual Sectors · 3 × distance": [
    "Setores virtuais · 3 × distância",
    "Virtual Sectors · 3 × distance"
  ],
  "Minisectors": [
    "Minissetores",
    "Minisectors"
  ],
  "Braking / Acceleration Points": [
    "Pontos de travagem / aceleração",
    "Braking / Acceleration Points"
  ],
  "TELEMETRY GRID": [
    "GRELHA DE TELEMETRIA",
    "TELEMETRY GRID"
  ],
  "ENGINEERING OVERVIEW": [
    "VISÃO GERAL DE ENGENHARIA",
    "ENGINEERING OVERVIEW"
  ],
  "ANALYSIS TABLES": [
    "TABELAS DE ANÁLISE",
    "ANALYSIS TABLES"
  ],
  "0 de 8 parâmetros alterados face à referência": [
    "0 de 8 parâmetros alterados face à referência",
    "0 of 8 parameters changed from reference"
  ],
  "Setup Lab": [
    "Laboratório de Setup",
    "Setup Lab"
  ]
});
Object.assign(dict,{"I. SETUP SHEET":["I. FOLHA DE SETUP","I. SETUP SHEET"],"II. RECOMMENDATION ENGINE":["II. MOTOR DE RECOMENDAÇÃO","II. RECOMMENDATION ENGINE"]});
Object.assign(dict,{"Personalizar layout":["Personalizar layout","Customize layout"],"Mover · redimensionar · ocultar":["Mover · redimensionar · ocultar","Move · resize · hide"],"Repor página":["Repor página","Reset page"],"Concluir":["Concluir","Done"],"Ligação à telemetria: LOGIN / SUPABASE":["Ligação à telemetria: LOGIN / SUPABASE","Telemetry connection: LOGIN / SUPABASE"],"Mapa, classificação, replay e controlo de corrida continuam ligados às fontes AMS existentes.":["Mapa, classificação, replay e controlo de corrida continuam ligados às fontes AMS existentes.","Map, standings, replay and race control remain connected to existing AMS sources."],"Valores não disponíveis aparecem como —. Não são gerados dados fictícios.":["Valores não disponíveis aparecem como —. Não são gerados dados fictícios.","Unavailable values are shown as —. No fictional data is generated."],"SEM LIVE":["SEM LIVE","NO LIVE DATA"],"Trajectória reconstruída por yawNorth + speed, alinhada à referência GPS da pista":["Trajectória reconstruída por yawNorth + speed, alinhada à referência GPS da pista","Trajectory reconstructed from yawNorth + speed, aligned to the track GPS reference"],"SEM TRAJECTÓRIA":["SEM TRAJECTÓRIA","NO TRAJECTORY"],"Modo de mapa":["Modo de mapa","Map mode"],"Comparação de trajectória em pista":["Comparação de trajectória em pista","On-track trajectory comparison"],"Não há trajetória disponível para esta volta.":["Não há trajetória disponível para esta volta.","No trajectory is available for this lap."],"Separação A / Ref":["Separação A / Ref","Separation A / Ref"],"Fonte":["Fonte","Source"],"Estimativa · LapDistPct + YawNorth":["Estimativa · LapDistPct + YawNorth","Estimate · LapDistPct + YawNorth"],"Indicadores da volta":["Indicadores da volta","Lap indicators"],"Zoom da volta":["Zoom da volta","Lap zoom"],"Início":["Início","Start"],"Fim":["Fim","End"],"Comparação":["Comparação","Comparison"],"SEM REFERÊNCIA":["SEM REFERÊNCIA","NO REFERENCE"],"Seleciona uma volta de referência para analisar entrada, apex e saída.":["Seleciona uma volta de referência para analisar entrada, apex e saída.","Select a reference lap to analyze corner entry, apex and exit."],"Entrada":["Entrada","Entry"],"Saída":["Saída","Exit"],"Δ zona":["Δ zona","Zone Δ"],"Mapa de ganho e perda":["Mapa de ganho e perda","Gain / loss map"],"Vista ampliada acompanha automaticamente o ponto atual":["Vista ampliada acompanha automaticamente o ponto atual","Zoomed view automatically follows the current position"],"Vista ampliada da trajectória":["Vista ampliada da trajectória","Zoomed trajectory view"],"Mapa geral da pista":["Mapa geral da pista","Full track map"],"A análise da zona atual aparece aqui durante o replay.":["A análise da zona atual aparece aqui durante o replay.","The current zone analysis appears here during replay."],"Seleciona duas voltas compatíveis e clica em Comparar para calcular 20 mini-setores reais.":["Seleciona duas voltas compatíveis e clica em Comparar para calcular 20 mini-setores reais.","Select two compatible laps and click Compare to calculate 20 real mini-sectors."],"Seleciona duas voltas compatíveis e clica em Comparar.":["Seleciona duas voltas compatíveis e clica em Comparar.","Select two compatible laps and click Compare."],"Seleciona duas voltas para analisar as curvas.":["Seleciona duas voltas para analisar as curvas.","Select two laps to analyze the corners."],"Selecionar curva":["Selecionar curva","Select corner"],"Apex estimado por velocidade mínima, direção e proximidade à curva geométrica. Não equivale ao apex físico confirmado por GPS.":["Apex estimado por velocidade mínima, direção e proximidade à curva geométrica. Não equivale ao apex físico confirmado por GPS.","Apex estimated from minimum speed, steering and proximity to the geometric corner. This is not a GPS-confirmed physical apex."],"Compara duas voltas compatíveis para analisar a qualidade da sobreposição.":["Compara duas voltas compatíveis para analisar a qualidade da sobreposição.","Compare two compatible laps to assess alignment quality."],"O diagnóstico verifica consistência entre traçado e trajetórias, mas não certifica coordenadas GPS reais.":["O diagnóstico verifica consistência entre traçado e trajetórias, mas não certifica coordenadas GPS reais.","The diagnostic checks track and trajectory consistency but does not certify actual GPS coordinates."],"Resumo de inteligência da sessão":["Resumo de inteligência da sessão","Session intelligence summary"],"Potencial de melhoria por zona":["Potencial de melhoria por zona","Improvement potential by zone"],"Maior perda mediana por zona":["Maior perda mediana por zona","Largest median loss by zone"],"Zonas com travagem repetível":["Zonas com travagem repetível","Zones with repeatable braking"],"Zonas com throttle repetível":["Zonas com throttle repetível","Zones with repeatable throttle input"],"Sem dados de tráfego validados":["Sem dados de tráfego validados","No validated traffic data"],"À espera de análise":["À espera de análise","Awaiting analysis"],"Traçado de referência carregado · sessão selecionada":["Traçado de referência carregado · sessão selecionada","Reference track loaded · session selected"],"SEM ANÁLISE":["SEM ANÁLISE","NO ANALYSIS"],"Máximo três objetivos · primeiro execução, depois setup":["Máximo três objetivos · primeiro execução, depois setup","Up to three goals · driving first, setup second"],"Sem análise.":["Sem análise.","No analysis."],"Analisa uma sessão para identificar zonas consistentes.":["Analisa uma sessão para identificar zonas consistentes.","Analyze a session to identify consistent zones."],"Aguarda dados da sessão.":["Aguarda dados da sessão.","Waiting for session data."],"As recomendações baseiam-se nas prioridades analisadas.":["As recomendações baseiam-se nas prioridades analisadas.","Recommendations are based on the analyzed priorities."],"Analisa uma sessão para verificar variações invulgares.":["Analisa uma sessão para verificar variações invulgares.","Analyze a session to check for unusual variations."],"Interpretação da evidência calculada pelo AMS · pós-sessão":["Interpretação da evidência calculada pelo AMS · pós-sessão","Interpretation of AMS-calculated evidence · post-session"],"Analisa a sessão e pede um briefing para receber prioridades, diagnóstico de consistência e leitura setup vs pilotagem.":["Analisa a sessão e pede um briefing para receber prioridades, diagnóstico de consistência e leitura setup vs pilotagem.","Analyze the session and request a briefing for priorities, consistency diagnostics and setup versus driving insights."],"A AI interpreta os cálculos do AMS; não substitui a evidência nem inventa ganhos de setup.":["A AI interpreta os cálculos do AMS; não substitui a evidência nem inventa ganhos de setup.","AI interprets AMS calculations; it does not replace evidence or invent setup gains."],"Ex.: Onde estou a perder mais tempo? Devo mexer no setup?":["Ex.: Onde estou a perder mais tempo? Devo mexer no setup?","E.g. Where am I losing the most time? Should I change the setup?"],"Indicadores adicionais de sessão (tempos e consistência)":["Indicadores adicionais de sessão (tempos e consistência)","Additional session metrics (times and consistency)"],"Variação entre voltas e classificação DRIVER / SETUP / BOTH / INCONCLUSIVE":["Variação entre voltas e classificação DRIVER / SETUP / BOTH / INCONCLUSIVE","Lap-to-lap variance and DRIVER / SETUP / BOTH / INCONCLUSIVE classification"],"A carregar classificação global…":["A carregar classificação global…","Loading global standings…"],"LAP RECORDS · Recorde por pista / carro":["LAP RECORDS · Recorde por pista / carro","LAP RECORDS · Record by track / car"],"Circuito, carro, piloto…":["Circuito, carro, piloto…","Track, car, driver…"],"RANKING · Progressão":["RANKING · Progressão","RANKING · Progression"],"Melhoria percentual entre a primeira volta e o melhor tempo pessoal nas mesmas combinações de pista e carro; requer pelo menos duas voltas.":["Melhoria percentual entre a primeira volta e o melhor tempo pessoal nas mesmas combinações de pista e carro; requer pelo menos duas voltas.","Percentage improvement from the first lap to the personal best for the same track and car combination; requires at least two laps."],"RANKING · Carreira":["RANKING · Carreira","RANKING · Career"],"Pilotos e permissões disponíveis para a conta autenticada":["Pilotos e permissões disponíveis para a conta autenticada","Drivers and permissions available to the signed-in account"],"SEM PILOTOS DISPONÍVEIS NESTA CONTA":["SEM PILOTOS DISPONÍVEIS NESTA CONTA","NO DRIVERS AVAILABLE FOR THIS ACCOUNT"],"Combustível · gestão de stint · planeamento de corrida":["Combustível · gestão de stint · planeamento de corrida","Fuel · stint management · race planning"],"A calcular":["A calcular","Calculating"],"Estratégia atual":["Estratégia atual","Current strategy"],"Sem plano":["Sem plano","No plan"],"Próxima paragem":["Próxima paragem","Next stop"],"Composto":["Composto","Compound"],"Os dados serão apresentados apenas quando existirem medições válidas.":["Os dados serão apresentados apenas quando existirem medições válidas.","Data will only appear when valid measurements are available."],"Seleciona uma sessão com telemetria para obter uma projeção fundamentada.":["Seleciona uma sessão com telemetria para obter uma projeção fundamentada.","Select a session with telemetry to obtain an evidence-based projection."],"Faixas meramente ilustrativas; não representam uma corrida gravada.":["Faixas meramente ilustrativas; não representam uma corrida gravada.","Illustrative bands only; they do not represent a recorded race."],"Combustível alvo":["Combustível alvo","Target fuel"],"A definir":["A definir","To be defined"],"Desgaste de pneus":["Desgaste de pneus","Tyre wear"],"Sem feed":["Sem feed","No feed"],"Guardar perfis de setup · comparar parâmetros · preparar experiências":["Guardar perfis de setup · comparar parâmetros · preparar experiências","Save setup profiles · compare parameters · prepare experiments"],"LOCAL · NÃO SINCRONIZADO":["LOCAL · NÃO SINCRONIZADO","LOCAL · NOT SYNCED"],"PARAMETER WORKSTATION · 8 AJUSTES DISPONÍVEIS":["PARAMETER WORKSTATION · 8 AJUSTES DISPONÍVEIS","PARAMETER WORKSTATION · 8 AVAILABLE ADJUSTMENTS"],"Comparação com a referência · sem estimativas de ganhos por volta":["Comparação com a referência · sem estimativas de ganhos por volta","Comparison with reference · no estimated lap-time gains"],"Catálogo: este navegador":["Catálogo: este navegador","Catalog: this browser"],"CONTEXTO REAL DO SETUP":["CONTEXTO REAL DO SETUP","REAL SETUP CONTEXT"],"Metadados da sessão gravada no Supabase":["Metadados da sessão gravada no Supabase","Session metadata saved in Supabase"],"Selecionar sessão real de telemetria":["Selecionar sessão real de telemetria","Select a real telemetry session"],"Nenhuma sessão gravada disponível":["Nenhuma sessão gravada disponível","No recorded sessions available"],"Inicia sessão para obter as tuas voltas e o carro.":["Inicia sessão para obter as tuas voltas e o carro.","Sign in to retrieve your laps and car."],"Última sessão":["Última sessão","Last session"],"Parâmetros de setup apresentados são genéricos. Não são uma leitura da garagem do iRacing nem valores calibrados para o carro.":["Parâmetros de setup apresentados são genéricos. Não são uma leitura da garagem do iRacing nem valores calibrados para o carro.","The setup parameters shown are generic. They are not readings from the iRacing garage or car-calibrated values."],"Nome do setup":["Nome do setup","Setup name"],"Mais categorias do mockup (sem parâmetros suportados)":["Mais categorias do mockup (sem parâmetros suportados)","Additional mockup categories (no supported parameters)"],"Dampers, diferencial, alinhamento e outras regulações exigem os canais e limites específicos de cada carro. Não foram criados controlos fictícios.":["Dampers, diferencial, alinhamento e outras regulações exigem os canais e limites específicos de cada carro. Não foram criados controlos fictícios.","Dampers, differential, alignment and other adjustments require car-specific channels and limits. No fictional controls were created."],"GARAGEM REAL · iRacing":["GARAGEM REAL · iRacing","REAL GARAGE · iRacing"],"Snapshots privados por piloto":["Snapshots privados por piloto","Private snapshots by driver"],"Os valores abaixo são provenientes de capturas fornecidas pelo piloto ou pelo programa Windows. Não alteram automaticamente os oito controlos genéricos.":["Os valores abaixo são provenientes de capturas fornecidas pelo piloto ou pelo programa Windows. Não alteram automaticamente os oito controlos genéricos.","The values below come from snapshots provided by the driver or Windows app. They do not automatically modify the eight generic controls."],"Seleciona uma sessão iRacing autenticada para consultar ou importar snapshots.":["Seleciona uma sessão iRacing autenticada para consultar ou importar snapshots.","Select an authenticated iRacing session to view or import snapshots."],"Sem sessão iRacing autenticada":["Sem sessão iRacing autenticada","No authenticated iRacing session"],"Guardar localmente":["Guardar localmente","Save locally"],"Sem previsão de delta de volta, confiança ou simulação fictícia.":["Sem previsão de delta de volta, confiança ou simulação fictícia.","No predicted lap delta, confidence score or fictional simulation."],"Sem dados específicos da pista":["Sem dados específicos da pista","No track-specific data"],"Analisa uma sessão no Engineer para obter evidência. Não são estimados ganhos ou níveis de confiança sem telemetria comparável.":["Analisa uma sessão no Engineer para obter evidência. Não são estimados ganhos ou níveis de confiança sem telemetria comparável.","Analyze a session in Engineer to obtain evidence. No gains or confidence estimates are made without comparable telemetry."],"Alterações relativamente à referência":["Alterações relativamente à referência","Changes from reference"],"igual":["igual","unchanged"],"São necessárias duas capturas reais para comparar alterações de garagem.":["São necessárias duas capturas reais para comparar alterações de garagem.","Two real snapshots are required to compare garage changes."],"Procurar setups guardados…":["Procurar setups guardados…","Search saved setups…"],"Sem perfis":["Sem perfis","No profiles"],"Ainda não existem setups guardados.":["Ainda não existem setups guardados.","There are no saved setups yet."],"Perfis guardados neste navegador. Ainda não sincronizados com Supabase.":["Perfis guardados neste navegador. Ainda não sincronizados com Supabase.","Profiles saved in this browser. Not yet synced with Supabase."],"SEM MODELO DE DESEMPENHO · COMPARAÇÃO REAL DE PARÂMETROS":["SEM MODELO DE DESEMPENHO · COMPARAÇÃO REAL DE PARÂMETROS","NO PERFORMANCE MODEL · REAL PARAMETER COMPARISON"],"Necessita de modelo validado":["Necessita de modelo validado","Requires a validated model"],"Não é possível prever":["Não é possível prever","Cannot predict"],"Necessita de stints A/B":["Necessita de stints A/B","Requires A/B stints"],"Sem previsão calibrada":["Sem previsão calibrada","No calibrated forecast"],"Sem dados por setup":["Sem dados por setup","No setup-specific data"],"Necessita de histórico":["Necessita de histórico","Requires historical data"],"Comparação local verificável":["Comparação local verificável","Verifiable local comparison"],"0 de 8 parâmetros alterados.":["0 de 8 parâmetros alterados.","0 of 8 parameters changed."],"0 de 8 parâmetros alterados face à referência.":["0 de 8 parâmetros alterados face à referência.","0 of 8 parameters changed from reference."]});
Object.assign(dict,{"A editar":["A editar","Editing"],"Alterar largura":["Alterar largura","Resize width"],"Seleciona uma volta para visualizar a trajetória.":["Seleciona uma volta para visualizar a trajetória.","Select a lap to view its trajectory."],"Seleciona uma volta com traçado validado.":["Seleciona uma volta com traçado validado.","Select a lap with a validated track map."],"Câmara Drone · seguir carro":["Câmara drone · seguir carro","Drone camera · follow car"],"Helicóptero · seguir":["Helicóptero · seguir","Helicopter · follow"],"Livre · orbitar":["Livre · orbitar","Free · orbit"],"Relevo 1× real":["Relevo 1× real","Terrain 1× actual"],"3× visível":["3× visível","3× visible"],"5× destacado":["5× destacado","5× enhanced"],"Câmara de seguimento · muda para Livre para orbitar · relevo apenas com altitudes válidas":["Câmara de seguimento · muda para Livre para orbitar · relevo apenas com altitudes válidas","Follow camera · switch to Free to orbit · terrain requires valid altitude data"],"Repor câmara":["Repor câmara","Reset camera"],"Camada Trajectory":["Camada de trajetória","Trajectory layer"],"Seleciona duas voltas para visualizar a comparação.":["Seleciona duas voltas para visualizar a comparação.","Select two laps to view the comparison."],"As curvas de telemetria e trajetória originais permanecem sincronizadas pelo motor AMS; não é criada geometria artificial.":["As curvas de telemetria e trajetória originais permanecem sincronizadas pelo motor AMS; não é criada geometria artificial.","Original telemetry and trajectory curves remain synchronized by the AMS engine; no artificial geometry is created."],"O veredito usa a análise de sessão existente. Os indicadores só são preenchidos após selecionar e analisar uma sessão.":["O veredito usa a análise de sessão existente. Os indicadores só são preenchidos após selecionar e analisar uma sessão.","The verdict uses existing session analysis. Indicators populate only after a session is selected and analyzed."],"Analisa uma sessão para gerar o diagnóstico.":["Analisa uma sessão para gerar o diagnóstico.","Analyze a session to generate the diagnosis."],"Última volta válida vs melhor volta · dados reais":["Última volta válida vs melhor volta · dados reais","Last valid lap vs best lap · real data"],"Perda vs. melhor segmento":["Perda vs. melhor segmento","Loss vs best segment"],"Questões rápidas ao engenheiro":["Questões rápidas ao engenheiro","Quick questions for the engineer"],"Testes e evidência":["Testes e evidência","Tests and evidence"],"Pesquisar setups locais":["Pesquisar setups locais","Search local setups"],"1 parâmetros":["1 parâmetro","1 parameter"],"1 parâmetro":["1 parâmetro","1 parameter"],"3 parâmetros":["3 parâmetros","3 parameters"],"4 parâmetros":["4 parâmetros","4 parameters"],"0 de 8 parâmetros alterados.":["0 de 8 parâmetros alterados.","0 of 8 parameters changed."]});
Object.assign(dict,{"Team / Coach":["Equipa / Treinador","Team / Coach"],"Pilotos e permissões disponíveis para a conta autenticada":["Pilotos e permissões disponíveis para a conta autenticada","Drivers and permissions available to the signed-in account"],"Pilot":["Piloto","Driver"],"Sem pilotos com telemetria gravada.":["Sem pilotos com telemetria gravada.","No drivers with recorded telemetry."],"Modo treinador · acesso aos pilotos autorizado por RLS":["Modo treinador · acesso aos pilotos autorizado por RLS","Coach mode · driver access authorized by RLS"],"Modo piloto · apenas os teus dados privados e referências partilhadas":["Modo piloto · apenas os teus dados privados e referências partilhadas","Driver mode · only your private data and shared references"],"Sem pilotos com duas voltas comparáveis.":["Sem pilotos com duas voltas comparáveis.","No drivers with two comparable laps."],"Sem pilotos com voltas registadas.":["Sem pilotos com voltas registadas.","No drivers with recorded laps."],"Contas de treinador autorizadas têm acesso global aos pilotos e telemetria.":["Contas de treinador autorizadas têm acesso global aos pilotos e telemetria.","Authorized coach accounts have access to all drivers and telemetry."],"Entra com a tua conta AMS. Contas de treinador autorizadas têm acesso global aos pilotos e telemetria.":["Entra com a tua conta AMS. Contas de treinador autorizadas têm acesso global aos pilotos e telemetria.","Sign in with your AMS account. Authorized coach accounts have access to all drivers and telemetry."],"SEM PILOTOS DISPONÍVEIS NESTA CONTA":["SEM PILOTOS DISPONÍVEIS NESTA CONTA","NO DRIVERS AVAILABLE FOR THIS ACCOUNT"]});
Object.assign(dict,{"Race Performance Snapshot":["Resumo do desempenho em corrida","Race Performance Snapshot"],"Race position":["Posição na corrida","Race position"],"Remaining laps":["Voltas restantes","Remaining laps"],"Operations & Data Quality":["Operações e qualidade dos dados","Operations & Data Quality"],"Tyres":["Pneus","Tyres"],"Vehicle Dynamics":["Dinâmica do veículo","Vehicle Dynamics"],"Fuel Strategy":["Estratégia de combustível","Fuel Strategy"],"metrics":["métricas","metrics"],"layout main":["layout principal","layout main"],"dashboard lower":["painel inferior","dashboard lower"],"Export CSV":["Exportar CSV","Export CSV"],"Time A":["Tempo A","Time A"],"Time Ref":["Tempo referência","Time Ref"],"Δ Time":["Δ Tempo","Δ Time"],"Speed A / Ref":["Velocidade A / Ref","Speed A / Ref"],"Brake A / Ref":["Travão A / Ref","Brake A / Ref"],"Throttle A / Ref":["Acelerador A / Ref","Throttle A / Ref"],"Gear A / Ref":["Mudança A / Ref","Gear A / Ref"],"Speed @ apex":["Velocidade no apex","Speed @ apex"],"GAINLOSS":["GANHO/PERDA","GAINLOSS"],"BRAKETHROTTLE":["TRAVAGEM/ACELERAÇÃO","BRAKETHROTTLE"],"Sector":["Setor","Sector"],"Range":["Intervalo","Range"],"Ref":["Ref","Ref"],"Speed min/max":["Velocidade mín/máx","Speed min/max"],"Brake peak":["Pico de travagem","Brake peak"],"Throttle avg":["Acelerador médio","Throttle avg"],"click row to zoom":["clicar numa linha para ampliar","click row to zoom"],"Type":["Tipo","Type"],"Peak/Input":["Pico/Entrada","Peak/Input"],"Duration":["Duração","Duration"],"Ref offset":["Desvio Ref","Ref offset"],"Track Focus · Trajectory Compare":["Foco na pista · Comparação de trajetória","Track Focus · Trajectory Compare"],"Lap Delta & Trajectory Workstation":["Delta de volta e análise de trajetória","Lap Delta & Trajectory Workstation"],"Reference status":["Estado da referência","Reference status"],"Speed Overlay":["Sobreposição da velocidade","Speed Overlay"],"Mini-sector Performance Explorer":["Análise de desempenho por minissetores","Mini-sector Performance Explorer"],"Corner Explorer · Geometria + Telemetria":["Análise de curvas · Geometria + Telemetria","Corner Explorer · Geometria + Telemetria"],"Corner Phases · Entry / Apex / Exit":["Fases da curva · Entrada / Apex / Saída","Corner Phases · Entry / Apex / Exit"],"Trajectory Alignment · Data Quality Audit":["Alinhamento de trajetórias · Auditoria de qualidade dos dados","Trajectory Alignment · Data Quality Audit"],"Track Analysis":["Análise de pista","Track Analysis"],"Next Stint Priorities":["Prioridades do próximo stint","Next Stint Priorities"],"Strengths":["Pontos fortes","Strengths"],"Weaknesses":["Pontos fracos","Weaknesses"],"Suggested Drills":["Exercícios recomendados","Suggested Drills"],"Detected Anomalies":["Anomalias detetadas","Detected Anomalies"],"Engineer Verdict":["Veredito do engenheiro","Engineer Verdict"],"EVIDENCE FIRST":["EVIDÊNCIA EM PRIMEIRO LUGAR","EVIDENCE FIRST"],"Setup Assessment":["Avaliação do setup","Setup Assessment"],"PROVISIONAL":["PROVISÓRIO","PROVISIONAL"],"AI Performance Engineer":["Engenheiro de desempenho IA","AI Performance Engineer"],"Driver Scorecard":["Ficha de desempenho do piloto","Driver Scorecard"],"SESSION":["SESSÃO","SESSION"],"Lap Comparison":["Comparação de voltas","Lap Comparison"],"Consistent pace":["Ritmo consistente","Consistent pace"],"Achievable lap":["Volta alcançável","Achievable lap"],"Engineer Evidence & Development":["Evidência e evolução da engenharia","Engineer Evidence & Development"],"Evidence by Zone":["Evidência por zona","Evidence by Zone"],"LAP RECORDS · Record by track / car":["RECORDES DE VOLTA · Recorde por pista / carro","LAP RECORDS · Record by track / car"],"RANKING · Progressão":["CLASSIFICAÇÃO · Progressão","RANKING · Progressão"],"RANKING · Carreira":["CLASSIFICAÇÃO · Carreira","RANKING · Carreira"],"PB Improvements":["Melhorias de recordes pessoais","PB Improvements"],"Custom Workspace":["Área de trabalho personalizada","Custom Workspace"],"Fuel on board":["Combustível disponível","Fuel on board"],"Consumption":["Consumo","Consumption"],"Laps remaining":["Voltas restantes","Laps remaining"],"Pit window":["Janela de paragem","Pit window"],"Pit Strategy":["Estratégia de boxes","Pit Strategy"],"Stint Timeline":["Cronologia dos stints","Stint Timeline"],"Strategy Notes":["Notas de estratégia","Strategy Notes"],"Weather / Flags":["Meteorologia / Bandeiras","Weather / Flags"],"Setup Lab & Tune Catalog":["Laboratório de Setup e catálogo de afinações","Setup Lab & Tune Catalog"],"1. Setup Sheet":["1. Ficha de setup","1. Setup Sheet"],"2. Recommendation Engine":["2. Motor de recomendações","2. Recommendation Engine"],"3. Tune Catalog":["3. Catálogo de afinações","3. Tune Catalog"],"4. SIMULATED IMPACT":["4. IMPACTO SIMULADO","4. SIMULATED IMPACT"],"Parameters changed":["Parâmetros alterados","Parameters changed"],"N/D PSI":["N/D PSI","N/A PSI"],"SEM LIVE":["SEM DADOS EM DIRETO","NO LIVE DATA"]});
const aliases=new Map();Object.entries(dict).forEach(([key,pair])=>{aliases.set(key,pair);aliases.set(pair[0],pair);aliases.set(pair[1],pair);});
const langIndex=()=>current==='pt'?0:1;
let current=(localStorage.getItem(KEY)||((navigator.language||'').toLowerCase().startsWith('pt')?'pt':'en'));if(!['pt','en'].includes(current))current='pt';
function t(key){const pair=aliases.get(key);return pair?pair[langIndex()]:key;}
function translateNode(node){if(!node||!node.parentElement)return;const el=node.parentElement;if(el.closest('script,style,textarea,code,pre,[data-i18n-ignore],svg'))return;const v=node.nodeValue||'';const match=v.match(/^(\s*)([\s\S]*?)(\s*)$/);if(!match)return;const pair=aliases.get(match[2]);if(pair){const translated=pair[langIndex()];if(match[2]!==translated)node.nodeValue=match[1]+translated+match[3];}}
function scan(root){if(!root)return;if(root.nodeType===3){translateNode(root);return;}if(root.nodeType!==1&&root.nodeType!==9)return;const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode()))translateNode(node);if(root.nodeType===1)translateAttrs(root);if(root.querySelectorAll)root.querySelectorAll('[title],[placeholder],[aria-label]').forEach(translateAttrs);}
function translateAttrs(el){for(const attr of ['title','placeholder','aria-label']){const val=el.getAttribute(attr);if(val&&aliases.has(val))el.setAttribute(attr,t(val));}}
let busy=false;const observer=new MutationObserver(records=>{if(busy)return;busy=true;observer.disconnect();for(const record of records){if(record.type==='characterData')scan(record.target);else if(record.type==='childList') record.addedNodes.forEach(scan);else if(record.type==='attributes') scan(record.target);}observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','placeholder','aria-label']});busy=false;});
function updateSelector(){document.documentElement.lang=current==='pt'?'pt-PT':'en';const control=document.getElementById('ams-language-select');if(control)control.value=current;}
function setLanguage(value){if(value!=='pt'&&value!=='en')return;current=value;localStorage.setItem(KEY,value);observer.disconnect();scan(document.body);updateSelector();observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','placeholder','aria-label']});document.dispatchEvent(new CustomEvent('ams:languagechange',{detail:{language:value}}));}
function init(){const actions=document.querySelector('.top-actions');if(actions&&!document.getElementById('ams-language-select')){const wrap=document.createElement('label');wrap.className='ams-language-control';wrap.setAttribute('aria-label','Language / Idioma');wrap.innerHTML='<span>🌐</span><select id="ams-language-select" aria-label="Language / Idioma"><option value="pt">PT</option><option value="en">EN</option></select>';actions.insertBefore(wrap,actions.firstChild);wrap.querySelector('select').addEventListener('change',e=>setLanguage(e.target.value));}setLanguage(current);}
window.AMSi18n={t,setLanguage,getLanguage:()=>current,translate:scan};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();