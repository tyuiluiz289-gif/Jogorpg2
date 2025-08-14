
const STORAGE_KEY = "survival_pwa_save_v1";

const DEFAULT_STATE = {
  dia: 1,
  periodo: "manhã",
  energia: 70,
  moral: 60,
  relLuan: 55,
  relMenina: 65,
  aguaL: 400,
  comida: 100,
  higiene: 20,
  itens: ["Carregador solar","Caixa de ferramentas","Tábuas e madeira"],
  flags: {
    pressentimentoVisto: false,
    luanChegou: false,
    oscilacao22h: false,
    mercadoNoite: false,
    meninaResgatada: false,
    revelacaoLuan: false,
    queda3h: false,
    comprasManha: false,
    fortificacao: true,
    ordemMilitar: true,
    mapaArmazem: false,
    ouviramTirosVizinhos: false,
    febreMenina: false,
    intrusoTestaPorta: false,
    armazemVisitado: false,
    vizinhoFeridoDentro: false,
  },
  log: [],
};

const clamp = (n, a=0, b=100)=> Math.max(a, Math.min(b, n));
const roll = (n=100)=> Math.floor(Math.random()*n)+1;

function consumeForPeriod(state) {
  const isMeal = state.periodo !== "madrugada";
  let comida = isMeal ? 3 : 1;
  let agua = isMeal ? 9 : 3;
  let hygiene = state.periodo === "noite" ? 1 : 0;
  let newState = { ...state };
  newState.comida = Math.max(0, newState.comida - comida);
  newState.aguaL = Math.max(0, newState.aguaL - agua);
  newState.higiene = Math.max(0, newState.higiene - hygiene);
  if (newState.comida <= 0) newState.energia = clamp(newState.energia - 8);
  if (newState.aguaL <= 0) newState.moral = clamp(newState.moral - 8);
  return newState;
}

function nextPeriod(state){
  const order = ["manhã","tarde","noite","madrugada"];
  const idx = order.indexOf(state.periodo);
  let nextIdx = (idx + 1) % order.length;
  let dia = state.dia + (nextIdx === 0 ? 1 : 0);
  let s = consumeForPeriod(state);
  return { ...s, periodo: order[nextIdx], dia };
}

function uniq(arr){ return Array.from(new Set(arr)); }
function deepMerge(a, b){
  const out = { ...a };
  for (const k in b){
    if (b[k] && typeof b[k]==="object" && !Array.isArray(b[k])) out[k] = deepMerge(a[k]||{}, b[k]);
    else out[k] = b[k];
  }
  return out;
}

function applyEffects(state, effects){
  if (!effects) return state;
  const patch = typeof effects === "function" ? effects(state) : effects;
  let next = deepMerge(state, patch);
  next.energia = clamp(next.energia);
  next.moral = clamp(next.moral);
  next.relLuan = clamp(next.relLuan);
  next.relMenina = clamp(next.relMenina);
  return next;
}

function advance(sceneKey, s, patch={}){
  let n = applyEffects(s, patch);
  n = nextPeriod(n);
  n._goto = sceneKey;
  return n;
}

function advanceDay(sceneKey, s){
  let n = { ...s };
  while (n.periodo !== "madrugada") n = nextPeriod(n);
  n = nextPeriod(n);
  n._goto = sceneKey;
  return n;
}

const SCENES = {
  pressentimento: {
    title: "Pressentimento no Escritório",
    text: (s)=> "O ar pesa. Sinais sutis: mensagens truncadas, clima esquisito nas ruas. Uma palavra ecoa: prepare-se.",
    choices: [
      { label: "Encerrar cedo e avisar Luan", to: "chegadaLuan", effects: (s)=>({ flags:{...s.flags, pressentimentoVisto:true} }) },
      { label: "Ignorar e continuar rotina", to: (s)=> (roll()>40 ? "chegadaLuan" : "oscilacao22h"), effects: (s)=>({ moral: clamp(s.moral-3) }) },
    ]
  },
  chegadaLuan: {
    title: "Chegada do Luan",
    text: ()=> "Luan surge sem aviso: férias de 2 dias. Traz suprimentos militares e um carregador solar.",
    choices: [
      { label: "Ajudar e inventariar", to:"inventario", effects:(s)=>({ relLuan: clamp(s.relLuan+5), flags:{...s.flags, luanChegou:true} }) },
      { label: "Cobrar explicações", to:"inventario", effects:(s)=>({ relLuan: clamp(s.relLuan-2), moral: clamp(s.moral+2), flags:{...s.flags, luanChegou:true} }) },
    ]
  },
  inventario: {
    title: "Inventário Rápido",
    text: (s)=> `Água: ${s.aguaL}L | Comida: ${s.comida} | Higiene: ${s.higiene}. Itens: ${s.itens.join(", ")}.`,
    choices: [{ label:"Avançar para a noite", to:"oscilacao22h" }]
  },
  oscilacao22h: {
    title: "22h – Oscilação",
    text: ()=> "Internet e rádio falham. O ar segura o som. Luan tranca o portão.",
    choices: [
      { label:"Ir ao mercado", to:"mercadoNoite", effects:(s)=>({ flags:{...s.flags, oscilacao22h:true} }) },
      { label:"Organizar o porão", to:"noiteCasa", effects:(s)=>({ relLuan: clamp(s.relLuan+2), flags:{...s.flags, oscilacao22h:true} }) },
    ]
  },
  mercadoNoite: {
    title: "Mercado à Noite",
    text: ()=> "Lotado. Um militar com família estoca. Uma menina cega, 14 anos, está sozinha.",
    choices: [
      { label:"Resgatar a menina", to:"retornoCasa", effects:(s)=>({ relMenina: clamp(s.relMenina+15), comida: s.comida+10, flags:{...s.flags, mercadoNoite:true, meninaResgatada:true} }) },
      { label:"Ignorar e estocar", to:"retornoCasa", effects:(s)=>({ comida: s.comida+20, moral: clamp(s.moral-8), flags:{...s.flags, mercadoNoite:true} }) },
    ]
  },
  retornoCasa: {
    title: "Retorno e Alerta",
    text: ()=> "De volta. Luan observa a rua. A menina ouve tudo. A tensão cresce.",
    choices: [
      { label:"Conversar com Luan", to:"revelacao" },
      { label:"Consolar a menina", to:"consolo" },
    ]
  },
  revelacao: {
    title: "Revelação do Luan",
    text: ()=> "Palavras do comandante: 'apocalipse', 'biológico', 'guerra'. Talvez precisem fugir.",
    choices: [
      { label:"Plano de contingência", to:"noiteCasa", effects:(s)=>({ relLuan: clamp(s.relLuan+5), flags:{...s.flags, revelacaoLuan:true} }) },
      { label:"Defender ficar", to:"noiteCasa", effects:(s)=>({ relLuan: clamp(s.relLuan-3), moral: clamp(s.moral+2), flags:{...s.flags, revelacaoLuan:true} }) },
    ]
  },
  consolo: {
    title: "Consolo",
    text: ()=> "Você promete proteger. Ela tenta parecer firme, mas treme.",
    choices: [{ label:"Seguir a noite", to:"noiteCasa", effects:(s)=>({ relMenina: clamp(s.relMenina+5) }) }]
  },
  noiteCasa: {
    title: "Noite Tensa",
    text: ()=> "Tiros distantes. Vidros estilhaçam. Luan dorme mal com o fuzil.",
    choices: [{ label:"Passar a madrugada", to:"madrugada3h" }]
  },
  madrugada3h: {
    title: "03h – Queda de Energia",
    text: ()=> "As luzes morrem. A rua silencia. Um cachorro late e para.",
    choices: [
      { label:"Checar disjuntores", to:"manutencao", effects:(s)=>({ flags:{...s.flags, queda3h:true} }) },
      { label:"Ficar em posição e escutar", to:"escuta", effects:(s)=>({ flags:{...s.flags, queda3h:true} }) },
    ]
  },
  manutencao: {
    title: "Manutenção de Emergência",
    text: ()=> "Nada queimou. É geral. O carregador solar será vital.",
    choices: [{ label:"Ir para manhã", to:"manhaCompras" }]
  },
  escuta: {
    title: "Silêncio Cortante",
    text: ()=> "Passos contidos a duas casas. Guardas? Saqueadores?",
    choices: [{ label:"Esperar a manhã", to:"manhaCompras" }]
  },
  manhaCompras: {
    title: "Manhã Seguinte",
    text: ()=> "Prateleiras vazias. Funcionários confusos. Última chance.",
    choices: [
      { label:"Comprar e voltar", to:"fortificarCasa", effects:(s)=>({ comida: s.comida+15 }) },
      { label:"Trocar por remédios", to:"fortificarCasa", effects:(s)=>({ comida: Math.max(0, s.comida-5), itens: uniq([...(s.itens||[]), 'Kit de primeiros socorros']) }) },
    ]
  },
  fortificarCasa: {
    title: "Fortificação",
    text: ()=> "Tábuas, portas reforçadas, setores de tiro. Você revisa água e comida.",
    choices: [{ label:"Continuar", to:"anuncioSoldado" }]
  },
  anuncioSoldado: {
    title: "Anúncio Militar",
    text: ()=> "TODOS EM CASA. ORDEM DE ABRIR FOGO. CIDADE ISOLADA.",
    choices: [{ label:"Consolidar rotina", to:"rotinaDia1" }]
  },
  rotinaDia1: {
    title: "Rotina – Dia 1",
    text: (s)=> `Dia ${s.dia}, ${s.periodo}. Turnos: vigia, preparo, descanso.`,
    choices: [
      { label:"Preparar comida e hidratar", to:(s)=> advance("rotinaDia1b", s) },
      { label:"Verificar telhado", to:(s)=> advance("rotinaDia1b", s, { energia:-5 }) },
      { label:"Treinar sinais com a menina", to:(s)=> advance("rotinaDia1b", s, { relMenina:+5, moral:+2 }) },
    ]
  },
  rotinaDia1b: {
    title: "Som à Distância",
    text: ()=> "Estalos e um grito na rua de trás. A menina: 'alguém pedindo ajuda'.",
    choices: [
      { label:"Ignorar", to:(s)=> advance("noiteDia1", s, { relLuan:+2, moral:-2 }) },
      { label:"Observar por fresta", to:"frestaAjuda" },
    ]
  },
  frestaAjuda: {
    title: "Fresta",
    text: ()=> "Vizinho ferido bate portas. Um vulto mais atrás observa.",
    choices: [
      { label:"Trazer com protocolo", to:"protocoloVizinho" },
      { label:"Sinalizar para esconder e voltar amanhã", to:(s)=> advance("noiteDia1", s, { moral:+2 }) },
    ]
  },
  protocoloVizinho: {
    title: "Protocolo de Entrada",
    text: ()=> "Antecâmara improvisada. Máscara, luvas, checagem. Luan cobre.",
    choices: [
      { label:"Revistar e tratar", to:(s)=> (roll()>40 ? "vizinhoOK" : "sombraSeguindo") },
    ]
  },
  sombraSeguindo: {
    title: "Sombra na Esquina",
    text: ()=> "A figura se aproxima quando a porta abre. Coração dispara.",
    choices: [
      { label:"Fechar e travar", to:(s)=> advance("noiteDia1", s, { relLuan:+3 }) },
      { label:"Intimidar e apontar", to:(s)=> (roll()>60 ? advance("noiteDia1", s, { moral:+2 }) : advance("noiteDia1", s, { moral:-2 })) },
    ]
  },
  vizinhoOK: {
    title: "Vizinho Estabilizado",
    text: ()=> "Ele entrega um mapa do 'Armazém 12'.",
    choices: [
      { label:"Guardar e planejar", to:(s)=> advance("noiteDia1", s, { flags:{...s.flags, mapaArmazem:true}, relMenina:+2 }) },
    ]
  },
  noiteDia1: {
    title: "Noite – Dia 1",
    text: ()=> "A casa silencia. O sono vem fragmentado.",
    choices: [{ label:"Passar madrugada", to:(s)=> advanceDay("manhaDia2", s) }]
  },
  manhaDia2: {
    title: "Manhã – Dia 2",
    text: (s)=> s.flags.armazemVisitado ?
      "Comida e remédios aliviam a febre. Um código de evacuação surge no rádio." :
      "A febre começa na menina. O mapa do armazém chama.",
    choices: [
      { label:"Tratar a febre (caseiro)", to:(s)=> advance("febre1", s, { higiene: Math.max(0, s.higiene-1), relMenina:+3 }) },
      { label:"Ir ao armazém 12", to:(s)=> (s.flags.mapaArmazem ? "caminhoArmazem" : advance("caminhoArmazem", s)) },
      { label:"Observar bairro e reforçar", to:(s)=> advance("observacaoBairro", s, { relLuan:+2 }) },
    ]
  },
  febre1: {
    title: "Febre",
    text: ()=> "Toalhas frias, hidratar, descanso. Falta antitérmico.",
    choices: [
      { label:"Improvisar e esperar", to:(s)=> advance("tardeDia2", s, { moral:-1, relMenina:+2, flags:{...s.flags, febreMenina:true} }) },
      { label:"Mandar Luan buscar remédio", to:(s)=> (roll()>55 ? advance("tardeDia2", s, { relLuan:+3 }) : advance("tardeDia2", s, { relLuan:-3 })) },
    ]
  },
  observacaoBairro: {
    title: "Observação do Bairro",
    text: ()=> "Portas arrombadas. Pano branco num portão. Gente nos telhados.",
    choices: [
      { label:"Fortificar telhado/fundos", to:(s)=> advance("tardeDia2", s, { energia:-5, relLuan:+2 }) },
      { label:"Mascarar caixa d’água/saída de ar", to:(s)=> advance("tardeDia2", s, { energia:-4, moral:+2 }) },
    ]
  },
  caminhoArmazem: {
    title: "Caminho para o Armazém 12",
    text: ()=> "Portão semiaberto. Ecos de passos lá dentro.",
    choices: [
      { label:"Entrar em silêncio", to:(s)=> (roll()>45 ? "armazemAchado" : "armadilha") },
      { label:"Chamar por alguém", to:(s)=> (roll()>70 ? "armazemAchado" : "armadilha") },
      { label:"Desistir e voltar", to:(s)=> advance("tardeDia2", s, { moral:-1 }) },
    ]
  },
  armazemAchado: {
    title: "Achados do Armazém",
    text: ()=> "Enlatados, comprimidos, gaze e um rádio de curto alcance.",
    choices: [
      { label:"Levar (rápido)", to:(s)=> advance("tardeDia2", s, { comida: s.comida+25, itens: uniq([...(s.itens||[]), 'Rádio curto alcance']), flags:{...s.flags, armazemVisitado:true} }) },
      { label:"Vasculhar mais", to:(s)=> (roll()>60 ? advance("tardeDia2", s, { comida: s.comida+35, higiene: s.higiene+2, flags:{...s.flags, armazemVisitado:true} }) : "armadilha") },
    ]
  },
  armadilha: {
    title: "Armadilha",
    text: ()=> "Passos aceleram. Vozes baixas. Uma sombra fecha a saída lateral.",
    choices: [
      { label:"Fuga pela janela", to:(s)=> (roll()>55 ? advance("tardeDia2", s, { energia:-8 }) : advance("tardeDia2", s, { energia:-12, moral:-3 })) },
      { label:"Confrontar e negociar", to:(s)=> (roll()>65 ? advance("tardeDia2", s, { moral:+2 }) : advance("tardeDia2", s, { moral:-4 })) },
    ]
  },
  tardeDia2: {
    title: "Tarde – Dia 2",
    text: (s)=> "Calor, casa apertada. Rádio militar chia. Silêncio seria melhor.",
    choices: [
      { label:"Cuidar da menina", to:(s)=> (s.flags.febreMenina ? advance("noiteDia2", s, { relMenina:+2 }) : advance("noiteDia2", s)) },
      { label:"Revisar perímetro", to:(s)=> advance("noiteDia2", s, { energia:-3, relLuan:+1 }) },
    ]
  },
  noiteDia2: {
    title: "Noite – Dia 2",
    text: ()=> "Alguém testa a maçaneta dos fundos e some. Vocês foram notados.",
    choices: [
      { label:"Armadilha sonora e bloqueio", to:(s)=> advance("madrugadaDia2", s, { energia:-4, relLuan:+2, flags:{...s.flags, intrusoTestaPorta:true} }) },
      { label:"Deixar como está", to:(s)=> advance("madrugadaDia2", s, { moral:-2 }) },
    ]
  },
  madrugadaDia2: {
    title: "Madrugada – Dia 2",
    text: ()=> "O sono vem em parcelas. A cidade aprende a sussurrar.",
    choices: [{ label:"Prosseguir (Dia 3)", to:(s)=> advanceDay("manhaDia3", s) }]
  },
  manhaDia3: {
    title: "Manhã – Dia 3",
    text: (s)=> s.flags.armazemVisitado
      ? "Estoque decente e remédios aliviam a febre. Rádio traz código de evacuação."
      : "Recursos apertam. Febre persiste. Um código de evacuação surge no rádio.",
    choices: [
      { label:"Decifrar código e avaliar evacuação", to:(s)=> advance("avaliarEvacuacao", s, { moral:+2 }) },
      { label:"Ficar e fortalecer base", to:(s)=> advance("planejarBase", s, { relLuan:+2 }) },
    ]
  },
  avaliarEvacuacao: {
    title: "Avaliar Evacuação",
    text: ()=> "Ponto a 4km, ponte bloqueada, ao escurecer. Cheiro de isca, mas pode ser a última carona.",
    choices: [
      { label:"Assumir o risco e ir", to:(s)=> (roll()>65 ? "fimSaidaBemSucedida" : "fimEmboscada") },
      { label:"Ficar e consolidar a fortaleza", to:"fimFicar" },
    ]
  },
  planejarBase: {
    title: "Plano de Base",
    text: ()=> "Teto reforçado, água disfarçada, rotas internas, evacuação só se perdermos variável crítica.",
    choices: [{ label:"Encerrar capítulo (ficar vivos)", to:"fimFicar" }]
  },
  fimFicar: {
    title: "CAPÍTULO 1 – Sobrevivência Estática",
    text: (s)=> `Ficam. Água ${s.aguaL}L, comida ${s.comida}. Luan confia. A menina dorme melhor.`,
    choices: [{ label:"Recomeçar", to:"pressentimento" }]
  },
  fimSaidaBemSucedida: {
    title: "CAPÍTULO 1 – Evacuação Parcial",
    text: ()=> "Contra as probabilidades, atravessam. Novas regras à frente.",
    choices: [{ label:"Recomeçar", to:"pressentimento" }]
  },
  fimEmboscada: {
    title: "CAPÍTULO 1 – Emboscada",
    text: ()=> "Sirenes falsas, tiros reais. Escapam por pouco. Aprendizado duro.",
    choices: [{ label:"Recomeçar", to:"pressentimento" }]
  },
};

function App(){
  const [state, setState] = React.useState(DEFAULT_STATE);
  const [sceneKey, setSceneKey] = React.useState("pressentimento");

  React.useEffect(()=>{
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw){
        const parsed = JSON.parse(raw);
        if (parsed?.state && parsed?.sceneKey){
          setState(parsed.state);
          setSceneKey(parsed.sceneKey);
        }
      }
    } catch {}
  }, []);

  React.useEffect(()=>{
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, sceneKey })); } catch {}
  }, [state, sceneKey]);

  const scene = SCENES[sceneKey];

  const choose = (choice)=>{
    let next = applyEffects(state, choice.effects);
    let target = typeof choice.to === "function" ? choice.to(next) : choice.to;
    if (next && next._goto){ target = next._goto; delete next._goto; }
    const entry = { t: new Date().toLocaleTimeString(), from: sceneKey, to: target, label: choice.label };
    setState(prev => ({ ...prev, ...next, log: [entry, ...prev.log].slice(0,30) }));
    setSceneKey(target);
  };

  const reset = ()=>{
    setState(DEFAULT_STATE);
    setSceneKey("pressentimento");
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  const Bar = ({value})=>(
    <div className="bar"><div style={{width: `${clamp(value)}%`}}></div></div>
  );

  return (
    <div className="grid" style={{gap:12}}>
      <header className="grid" style={{gap:8}}>
        <div className="card">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <h1 style={{margin:0}}>Sobrevivência – Capítulo 1</h1>
            <button onClick={reset} className="btn" style={{width:'auto'}}>Reiniciar</button>
          </div>
        </div>
      </header>

      <section className="grid grid-3" style={{gap:12}}>
        <div className="card">
          <small>Energia</small>
          <div style={{display:'flex', gap:8, alignItems:'center', marginTop:6}}>
            <Bar value={state.energia} /><span style={{width:36, textAlign:'right'}}>{state.energia}</span>
          </div>
        </div>
        <div className="card">
          <small>Moral</small>
          <div style={{display:'flex', gap:8, alignItems:'center', marginTop:6}}>
            <Bar value={state.moral} /><span style={{width:36, textAlign:'right'}}>{state.moral}</span>
          </div>
        </div>
        <div className="card">
          <small>Dia / Período</small>
          <div style={{marginTop:6}}>Dia {state.dia} — {state.periodo}</div>
        </div>
      </section>

      <section className="grid grid-3" style={{gap:12}}>
        <div className="card">
          <small>Relações</small>
          <div style={{marginTop:6}}>Luan: {state.relLuan} / Menina: {state.relMenina}</div>
        </div>
        <div className="card">
          <small>Recursos</small>
          <div style={{marginTop:6}}>Água: {state.aguaL}L | Comida: {state.comida} | Higiene: {state.higiene}</div>
        </div>
        <div className="card">
          <small>Itens</small>
          <div className="chips" style={{marginTop:6}}>
            {(state.itens?.length ? state.itens : ["—"]).map((it,i)=>(<span key={i}>{it}</span>))}
          </div>
        </div>
      </section>

      <main className="card">
        <h2 style={{marginTop:0}}>{scene.title}</h2>
        <p>{scene.text(state)}</p>
        <div>
          {scene.choices.map((c, i)=>(
            <button key={i} className="btn" onClick={()=>choose(c)}>
              {i+1}. {c.label}
            </button>
          ))}
        </div>
      </main>

      <aside className="card">
        <small>Eventos</small>
        <ol style={{fontSize:12, opacity:.9}}>
          {state.log.map((e,i)=>(<li key={i}><span style={{opacity:.6}}>{e.t}</span> — <b>{e.label}</b> → <span style={{opacity:.8}}>{e.to}</span></li>))}
        </ol>
      </aside>

      <footer className="card"><small>Instale: menu do Chrome › Adicionar à tela inicial. Depois abra offline.</small></footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
