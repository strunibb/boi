(() => {
  "use strict";
  const api = window.StrunyCustom;
  if (!api) return;

  const tools = [
    {type:"down", symbol:"↓", name:"Вниз"},
    {type:"up", symbol:"↑", name:"Вверх"},
    {type:"mute", symbol:"×", name:"Глушение"},
    {type:"rest", symbol:"·", name:"Без звука"},
    {type:"deadDown", symbol:"↓×", name:"Мёртвый ↓"},
    {type:"deadUp", symbol:"↑×", name:"Мёртвый ↑"},
    {type:"bass", symbol:"Б", name:"Бас"},
    {type:"string3", symbol:"3", name:"3-я струна"},
    {type:"string21", symbol:"21", name:"2-я + 1-я"},
    {type:"string321", symbol:"321", name:"3-2-1"},
    {type:"string2", symbol:"2", name:"2-я струна"},
    {type:"string1", symbol:"1", name:"1-я струна"}
  ];
  const toolMap = new Map(tools.map(tool => [tool.type,tool]));
  const isStrum = type => type === "down" || type === "up";
  const copyEvents = events => events.map(event => ({
    type:event.type,
    ...(isStrum(event.type) && event.accent ? {accent:true} : {}),
    ...(isStrum(event.type) && event.bassOnly ? {bassOnly:true} : {})
  }));

  const dialog = document.createElement("dialog");
  dialog.id = "rhythmEditor";
  dialog.setAttribute("aria-labelledby","rhythmEditorTitle");
  dialog.innerHTML = [
    '<div class="dialog-head">',
      '<div><span class="rhythm-kicker">Струны будущего · конструктор</span>',
      '<h2 id="rhythmEditorTitle">Создать свой бой</h2></div>',
      '<button type="button" class="close-dialog" id="closeRhythmEditor" aria-label="Закрыть редактор">×</button>',
    '</div>',
    '<form id="rhythmForm">',
      '<div class="rhythm-fields">',
        '<label>Название боя<input id="rhythmName" maxlength="60" required placeholder="Например, мой рок-бой"></label>',
        '<label>Движений<select id="rhythmLength">',
          '<option value="4">4</option><option value="6">6</option>',
          '<option value="8">8</option><option value="12">12</option>',
          '<option value="16">16</option><option value="24">24</option><option value="32">32</option>',
        '</select></label>',
        '<label>Темп, BPM<input id="rhythmTempo" type="number" min="40" max="250" step="1" value="80" required></label>',
      '</div>',
      '<p class="rhythm-instruction">Нажми на клетку, затем выбери действие ниже. После каждого действия выделение переходит к следующей клетке. Одна клетка = половина доли (восьмая нота).</p>',
      '<div class="rhythm-caption">Обозначения <span>Нажми на знак, чтобы вставить его</span></div>',
      '<div class="rhythm-palette" id="rhythmPalette" role="group" aria-label="Типы ударов и пауз"></div>',
      '<div class="rhythm-caption">Твой рисунок <span id="rhythmStepLabel">Выбрана клетка 1</span></div>',
      '<div class="rhythm-grid" id="rhythmGrid" aria-label="Редактор последовательности"></div>',
      '<div class="rhythm-flags">',
        '<label><input id="rhythmAccent" type="checkbox"> Акцент &gt; (сильнее)</label>',
        '<label><input id="rhythmBassOnly" type="checkbox"> Только басовые струны</label>',
        '<small>Работает для ударов ↓ и ↑</small>',
      '</div>',
      '<p class="rhythm-feedback" id="rhythmFeedback" role="status" aria-live="polite"></p>',
      '<div class="rhythm-footer">',
        '<button type="button" class="rhythm-delete" id="rhythmDelete" hidden>Удалить бой</button>',
        '<button type="button" class="rhythm-clear" id="rhythmClear">Очистить</button>',
        '<button type="button" class="rhythm-preview" id="rhythmPreview">▶ Послушать</button>',
        '<button type="submit" class="rhythm-save" id="rhythmSave">Сохранить бой</button>',
      '</div>',
    '</form>'
  ].join("");
  document.body.appendChild(dialog);

  const el = id => dialog.querySelector("#" + id);
  const title = el("rhythmEditorTitle");
  const name = el("rhythmName");
  const length = el("rhythmLength");
  const tempo = el("rhythmTempo");
  const grid = el("rhythmGrid");
  const palette = el("rhythmPalette");
  const feedback = el("rhythmFeedback");
  const accent = el("rhythmAccent");
  const bassOnly = el("rhythmBassOnly");
  const deleteButton = el("rhythmDelete");
  const previewButton = el("rhythmPreview");
  const editButton = document.getElementById("editPattern");
  const cloneButton = document.getElementById("clonePattern");
  const addButton = document.getElementById("createPattern");

  let draft = null;
  let selected = 0;
  let previewing = false;

  palette.innerHTML = tools.map(tool =>
    '<button type="button" class="rhythm-tool" data-tool="' + tool.type +
    '" aria-label="' + tool.name + '" title="' + tool.name + '">' +
    '<span aria-hidden="true">' + tool.symbol + '</span>' + tool.name + '</button>'
  ).join("");

  function stopPreview() {
    if (!previewing) return;
    previewing = false;
    api.endPreview();
    previewButton.textContent = "▶ Послушать";
  }

  function refreshGrid() {
    if (!draft) return;
    grid.innerHTML = draft.events.map((event,index) => {
      const tool = toolMap.get(event.type) || toolMap.get("rest");
      const flags = (event.accent ? ", с акцентом" : "") + (event.bassOnly ? ", по басовым" : "");
      const css = "rhythm-step" + (index===selected ? " is-selected" : "") +
        (event.type === "rest" ? " is-rest" : "") +
        (["mute","deadDown","deadUp"].includes(event.type) ? " is-muted" : "") +
        (event.accent ? " is-accent" : "") + (event.bassOnly ? " is-bass" : "");
      return '<button type="button" class="' + css + '" data-step="' + index +
        '" aria-pressed="' + (index===selected) + '" aria-label="Клетка ' +
        (index+1) + ': ' + tool.name + flags + '">' +
        '<span class="rhythm-count">' + (index%2 ? "и" : Math.floor(index/2)+1) + '</span>' +
        '<span class="rhythm-symbol" aria-hidden="true">' + tool.symbol + '</span></button>';
    }).join("");
    const event = draft.events[selected];
    const available = isStrum(event.type);
    accent.checked = !!event.accent;
    bassOnly.checked = !!event.bassOnly;
    accent.disabled = !available;
    bassOnly.disabled = !available;
    el("rhythmStepLabel").textContent = "Выбрана клетка " + (selected + 1) + " из " + draft.events.length;
    palette.querySelectorAll("[data-tool]").forEach(button => {
      button.classList.toggle("is-picked",button.dataset.tool===event.type);
    });
  }

  function changeDraft() {
    stopPreview();
    feedback.textContent = "";
    refreshGrid();
  }

  function openEditor(pattern=null, clone=false) {
    stopPreview();
    api.pause();
    const editing = !!pattern && pattern.category === "custom" && !clone;
    if (!editing && api.getCustom().length >= 50) {
      api.notify("Лимит: 50 собственных боёв. Удали ненужный перед созданием нового");
      return;
    }
    const seed = pattern || null;
    const events = seed ? copyEvents(seed.events) :
      ["down","rest","down","up","down","rest","down","up"].map(type => ({type}));
    draft = {
      id:editing ? seed.id : null,
      title:editing ? seed.title : clone && seed ? "Мой " + seed.title : "",
      tempo:seed ? seed.tempo : api.getBpm(),
      events
    };
    selected = 0;
    title.textContent = editing ? "Редактировать свой бой" : clone ? "Бой по образцу" : "Создать свой бой";
    name.value = draft.title.slice(0,60);
    length.value = String(events.length);
    tempo.value = String(draft.tempo);
    deleteButton.hidden = !editing;
    feedback.textContent = "";
    refreshGrid();
    dialog.showModal();
    name.focus();
  }

  palette.addEventListener("click", event => {
    const button = event.target.closest("[data-tool]");
    if (!button || !draft) return;
    const type = button.dataset.tool;
    if (!toolMap.has(type)) return;
    const previous = draft.events[selected];
    draft.events[selected] = {
      type,
      ...(isStrum(type) && previous.accent ? {accent:true} : {}),
      ...(isStrum(type) && previous.bassOnly ? {bassOnly:true} : {})
    };
    selected = (selected + 1) % draft.events.length;
    changeDraft();
  });

  grid.addEventListener("click", event => {
    const button = event.target.closest("[data-step]");
    if (!button || !draft) return;
    selected = Number(button.dataset.step);
    refreshGrid();
  });

  length.addEventListener("change", () => {
    if (!draft) return;
    const count = Number(length.value);
    if (![4,6,8,12,16,24,32].includes(count)) return;
    if (count < draft.events.length) draft.events.length = count;
    while (draft.events.length < count) draft.events.push({type:"rest"});
    selected = Math.min(selected,count-1);
    changeDraft();
  });

  accent.addEventListener("change", () => {
    if (!draft || !isStrum(draft.events[selected].type)) return;
    if (accent.checked) draft.events[selected].accent = true;
    else delete draft.events[selected].accent;
    changeDraft();
  });

  bassOnly.addEventListener("change", () => {
    if (!draft || !isStrum(draft.events[selected].type)) return;
    if (bassOnly.checked) draft.events[selected].bassOnly = true;
    else delete draft.events[selected].bassOnly;
    changeDraft();
  });

  function dataFromForm() {
    const rhythmName = name.value.trim();
    const rhythmTempo = Number(tempo.value);
    if (!rhythmName) throw Error("Укажи название боя");
    if (rhythmName.length > 60) throw Error("Название слишком длинное");
    if (!Number.isInteger(rhythmTempo) || rhythmTempo < 40 || rhythmTempo > 250)
      throw Error("Темп должен быть от 40 до 250 BPM");
    if (draft.events.every(event => event.type === "rest"))
      throw Error("Добавь хотя бы один удар или звук");
    return {id:draft.id,title:rhythmName,tempo:rhythmTempo,events:copyEvents(draft.events)};
  }

  previewButton.addEventListener("click", async () => {
    if (!draft) return;
    if (previewing) {stopPreview();return;}
    try {
      const data = dataFromForm();
      previewing = true;
      previewButton.textContent = "■ Остановить";
      await api.beginPreview(data);
    } catch (error) {
      stopPreview();
      feedback.textContent = error.message || "Не удалось воспроизвести бой";
    }
  });

  el("rhythmClear").addEventListener("click", () => {
    if (!draft) return;
    draft.events = draft.events.map(() => ({type:"rest"}));
    selected = 0;
    changeDraft();
  });

  el("rhythmForm").addEventListener("submit", event => {
    event.preventDefault();
    if (!draft) return;
    try {
      const data = dataFromForm();
      stopPreview();
      api.save(data);
      dialog.close();
      api.notify("Бой «" + data.title + "» сохранён в разделе «Мои бои»");
      refreshEditButton();
    } catch (error) {
      feedback.textContent = error.message || "Не удалось сохранить бой";
    }
  });

  deleteButton.addEventListener("click", () => {
    if (!draft || !draft.id) return;
    if (!window.confirm("Удалить бой «" + draft.title + "»?")) return;
    stopPreview();
    api.remove(draft.id);
    dialog.close();
    api.notify("Свой бой удалён");
    refreshEditButton();
  });

  const close = () => dialog.close();
  el("closeRhythmEditor").addEventListener("click",close);
  dialog.addEventListener("close",stopPreview);
  dialog.addEventListener("cancel",stopPreview);

  function refreshEditButton() {
    const current = api.getCurrent();
    editButton.hidden = current.category !== "custom";
  }

  addButton.addEventListener("click",() => openEditor());
  cloneButton.addEventListener("click",() => openEditor(api.getCurrent(),true));
  editButton.addEventListener("click",() => openEditor(api.getCurrent()));
  new MutationObserver(refreshEditButton).observe(
    document.getElementById("patternTitle"),{childList:true,characterData:true,subtree:true}
  );
  refreshEditButton();
})();
