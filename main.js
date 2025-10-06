import { CHARACTERS } from "./data.js";
const SOUND_FILES = {
  "Sonic Pulse": "sonic_pulse.mp3",
  "Phaser Shot": "phaser_shot.mp3",
  "Flux Arc": "flux_arc.mp3",
  "Endo Burst": "endo_burst.mp3"
};

// State
const rosterEl = document.getElementById("roster");
const teamAEl = document.getElementById("teamA");
const teamBEl = document.getElementById("teamB");
const startBtn = document.getElementById("startBattle");
const arenaEl = document.getElementById("arena");
const activeAEl = document.getElementById("activeA");
const activeBEl = document.getElementById("activeB");
const attackBtn = document.getElementById("attackBtn");
const switchBtn = document.getElementById("switchBtn");
const resetBtn = document.getElementById("resetBtn");
const turnInd = document.getElementById("turnIndicator");
const layer = document.getElementById("projectileLayer");

// Inicialização de áudio com tratamento de erro
const SOUNDS = Object.fromEntries(
  Object.entries(SOUND_FILES).map(([k, v]) => [
    k,
    Object.assign(new Audio(v), { preload: "auto", volume: 0.6 }),
  ])
);

function playSound(name) {
  const a = SOUNDS[name];
  if (a) {
    a.currentTime = 0;
    // Captura o erro de Promessa (common em iOS/mobile) para não quebrar o jogo
    a.play().catch(() => {});
  }
}

const state = {
  roster: [...CHARACTERS],
  teamA: [],
  teamB: [],
  battle: null,
};

const deepClone = (obj) =>
  typeof structuredClone === "function"
    ? structuredClone(obj)
    : JSON.parse(JSON.stringify(obj));

// UI helpers
function cardTemplate(c) {
  const div = document.createElement("div");
  div.className = "card";
  div.innerHTML = `
    <h3>${c.name}</h3>
    <div class="meta">
      <span class="badge">${c.universe}</span>
      <span class="badge">${c.role}</span>
    </div>
    <div class="statline"><span>HP</span><strong>${c.hp}</strong></div>
    <div class="statline"><span>ATQ</span><strong>${c.attack}</strong></div>
    <div class="statline"><span>VEL</span><strong>${c.speed}</strong></div>
    <div class="actions">
      <button data-add="A">Adicionar A</button>
      <button data-add="B">Adicionar B</button>
    </div>
  `;
  div.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", () => addToTeam(btn.dataset.add, c));
  });
  return div;
}

function miniTemplate(c, teamKey, idx) {
  const wrap = document.createElement("div");
  wrap.className = "mini";
  wrap.innerHTML = `<span>${c.name}</span><button data-remove="${idx}">Remover</button>`;
  wrap.querySelector("button").addEventListener("click", () => {
    state[teamKey].splice(idx, 1);
    renderTeams();
    validateStart();
  });
  return wrap;
}

function activeTemplate(c) {
  const div = document.createElement("div");
  div.className = "card";
  div.innerHTML = `
    <h3>${c.name}</h3>
    <div class="meta">
      <span class="badge">${c.universe}</span><span class="badge">${c.role}</span>
    </div>
    <div class="statline"><span>Ataque</span><strong>${c.attack}</strong></div>
    <div class="statline"><span>Vantagem</span><strong>${c.attackName}</strong></div>
    <div class="health" aria-label="Barra de vida">
      <div class="bar" style="width:${c.hpPct ?? 100}%"></div>
    </div>
  `;
  return div;
}

// Render
function renderRoster() {
  rosterEl.innerHTML = "";
  state.roster.forEach((c) => rosterEl.appendChild(cardTemplate(c)));
}
function renderTeams() {
  teamAEl.innerHTML = "";
  teamBEl.innerHTML = "";
  state.teamA.forEach((c, i) =>
    teamAEl.appendChild(miniTemplate(c, "teamA", i))
  );
  state.teamB.forEach((c, i) =>
    teamBEl.appendChild(miniTemplate(c, "teamB", i))
  );
}
function renderActive() {
  activeAEl.innerHTML = "";
  activeBEl.innerHTML = "";
  const a = state.battle.teamA[0];
  const b = state.battle.teamB[0];
  activeAEl.appendChild(activeTemplate(a));
  activeBEl.appendChild(activeTemplate(b));
}

// Team management
function addToTeam(side, c) {
  const key = side === "A" ? "teamA" : "teamB";
  // Limite de 3 personagens
  if (state[key].length >= 3) return;
  state[key].push(deepClone(c));
  renderTeams();
  validateStart();
}
function validateStart() {
  // Apenas permite iniciar se ambas as equipes tiverem pelo menos 1
  startBtn.disabled = !(state.teamA.length && state.teamB.length);
}

// Battle
function startBattle() {
  state.battle = {
    teamA: state.teamA.map((c) => ({ ...c, hpCur: c.hp, hpPct: 100 })),
    teamB: state.teamB.map((c) => ({ ...c, hpCur: c.hp, hpPct: 100 })),
    turn: "A", // Simples: A começa
  };
  document.querySelector(".deck-select").hidden = true;
  arenaEl.hidden = false;
  attackBtn.disabled = false;
  checkSwitchButtonState(); // Verifica o estado inicial do botão 'Trocar'
  renderActive();
  updateTurnText();
}

function updateTurnText() {
  turnInd.textContent = `Vez: Equipe ${state.battle.turn}`;
}

// NOVO: Verifica e desativa o botão de troca se não houver reservas no time da vez
function checkSwitchButtonState() {
  const teamKey = state.battle.turn === "A" ? "teamA" : "teamB";
  switchBtn.disabled = state.battle[teamKey].length <= 1;
}

function clampHealth(char) {
  char.hpCur = Math.max(0, char.hpCur);
  char.hpPct = Math.round((char.hpCur / char.hp) * 100);
}

function checkKO() {
  const a = state.battle.teamA[0];
  const b = state.battle.teamB[0];
  let koHappened = false;

  // Verifica KO no time A
  if (a.hpCur <= 0) {
    state.battle.teamA.shift();
    koHappened = true;
  }
  // Verifica KO no time B
  if (b.hpCur <= 0) {
    state.battle.teamB.shift();
    koHappened = true;
  }
  
  if (!state.battle.teamA.length || !state.battle.teamB.length) {
    attackBtn.disabled = true;
    switchBtn.disabled = true;
    turnInd.textContent = !state.battle.teamA.length
      ? "Vitória: Equipe B"
      : "Vitória: Equipe A";
    return true; // Fim de jogo
  }
  
  // Se houve KO, renderiza a nova carta ativa (se houver)
  if (koHappened) {
      renderActive();
  }

  return false;
}

function switchActive() {
  const teamKey = state.battle.turn === "A" ? "teamA" : "teamB";
  if (state.battle[teamKey].length > 1) {
    const arr = state.battle[teamKey];
    arr.push(arr.shift()); // Move o primeiro para o final
    renderActive();
    // Passa o turno
    state.battle.turn = state.battle.turn === "A" ? "B" : "A";
    updateTurnText();
    checkSwitchButtonState(); // Verifica o estado do botão para o novo turno
  }
}

// Attack visuals
function getPositions() {
  const aRect = activeAEl.getBoundingClientRect();
  const bRect = activeBEl.getBoundingClientRect();
  const layerRect = layer.getBoundingClientRect();
  if (!aRect.width || !bRect.width || !layerRect.width) {
    return { from: { x: 0, y: 0 }, to: { x: 0, y: 0 } };
  }
  // Calcula as posições relativas ao projectileLayer
  const from = {
    x: aRect.right - layerRect.left,
    y: aRect.top - layerRect.top + aRect.height / 2,
  };
  const to = {
    x: bRect.left - layerRect.left,
    y: bRect.top - layerRect.top + bRect.height / 2,
  };
  return { from, to };
}

function animateAttack(pattern, cb) {
  const { from, to } = getPositions();
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx || 0, dy || 0);
  const angle = Math.atan2(dy || 0, dx || 1);

  let el;
  const duration = 380; // ms
  const start = performance.now();

  if (pattern === "beam") {
    el = document.createElement("div");
    el.className = "beam";
    el.style.left = `${from.x}px`;
    el.style.top = `${from.y}px`;
    el.style.width = `0px`;
    el.style.transform = `rotate(${angle}rad)`;
    layer.appendChild(el);
  } else if (pattern === "dot") {
    el = document.createElement("div");
    el.className = "shape";
    el.style.width = "10px";
    el.style.height = "10px";
    layer.appendChild(el);
  } else if (pattern === "zig") {
    el = document.createElement("div");
    el.className = "zig";
    el.style.height = "24px";
    layer.appendChild(el);
  } else if (pattern === "burst") {
    // multiple dots
    const dots = Array.from({ length: 4 }).map(() => {
      const d = document.createElement("div");
      d.className = "shape";
      d.style.width = "8px";
      d.style.height = "8px";
      layer.appendChild(d);
      return d;
    });
    return animateMultiDots(dots, from, to, duration, cb);
  }

  function frame(t) {
    const p = Math.min(1, (t - start) / duration);
    const x = from.x + dx * p;
    const y = from.y + dy * p;

    if (pattern === "beam") {
      el.style.transform = `translateX(0) rotate(${angle}rad)`;
      el.style.left = `${from.x}px`;
      el.style.top = `${from.y}px`;
      el.style.width = `${dist * p}px`;
    } else if (pattern === "dot") {
      el.style.transform = `translate(${x - 5}px, ${y - 5}px)`;
    } else if (pattern === "zig") {
      const wobble = Math.sin(p * Math.PI * 4) * 8;
      el.style.transform = `translate(${x}px, ${y + wobble}px) rotate(${angle}rad)`;
      el.style.left = "0px";
      el.style.top = "0px";
    }

    if (p < 1) {
      requestAnimationFrame(frame);
    } else {
      el.remove();
      if (cb) cb();
    }
  }
  requestAnimationFrame(frame);
}

function animateMultiDots(dots, from, to, duration, cb) {
  const start = performance.now();
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  function frame(t) {
    const p = Math.min(1, (t - start) / duration);
    dots.forEach((d, i) => {
      // Pequeno offset para espalhar o "burst"
      const offset = (i - 1.5) * 10 * (1 - p); // Espalha mais no início
      const x = from.x + dx * p + offset;
      const y = from.y + dy * p + Math.sin((p + i) * Math.PI) * 6;
      d.style.transform = `translate(${x - 4}px, ${y - 4}px)`;
    });
    if (p < 1) requestAnimationFrame(frame);
    else {
      dots.forEach((d) => d.remove());
      if (cb) cb();
    }
  }
  requestAnimationFrame(frame);
}

// Attack resolution
function performAttack() {
  const atkTeam = state.battle.turn === "A" ? state.battle.teamA : state.battle.teamB;
  const defTeam = state.battle.turn === "A" ? state.battle.teamB : state.battle.teamA;
  const attacker = atkTeam[0];
  const defender = defTeam[0];
  
  attackBtn.disabled = true; // Desativa o botão durante o ataque
  playSound(attacker.attackName);
  
  animateAttack(attacker.pattern, () => {
    // Resolução do dano
    defender.hpCur -= attacker.attack;
    clampHealth(defender);
    renderActive(); // Atualiza a barra de vida do defensor

    const over = checkKO(); // Verifica KO após o dano
    
    if (!over) {
      // Se o jogo continua, troca o turno
      state.battle.turn = state.battle.turn === "A" ? "B" : "A";
      updateTurnText();
      attackBtn.disabled = false; // Reativa o botão para o próximo turno
      checkSwitchButtonState(); // Verifica o estado do botão Trocar para o próximo turno
    }
    // Se o jogo acabou, os botões permanecem desativados pelo checkKO
  });
}

// Events
startBtn.addEventListener("click", startBattle);
attackBtn.addEventListener("click", performAttack);
switchBtn.addEventListener("click", switchActive);
resetBtn.addEventListener("click", () => location.reload());

// Init
renderRoster();
renderTeams();
validateStart();
attackBtn.disabled = true; 
// O estado inicial do switchBtn é agora gerenciado por checkSwitchButtonState() em startBattle.