const API = "http://localhost:3000";
const FIPE = "https://parallelum.com.br/fipe/api/v1/carros";
const SESSION_KEY = "carcheck_session";
const $ = selector => document.querySelector(selector);
const byId = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
}[char]));
const formatKm = value => `${Number(value || 0).toLocaleString("pt-BR")} km`;
const formatBrl = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatDate = value => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR") : "";
const today = () => new Date().toISOString().slice(0, 10);
const userSession = {
  get() { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; } },
  set(user) { sessionStorage.setItem(SESSION_KEY, JSON.stringify(user)); },
  clear() { sessionStorage.removeItem(SESSION_KEY); }
};

async function request(path, { method = "GET", body } = {}) {
  try {
    const response = await fetch(`${API}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    let data = null;
    try { data = await response.json(); } catch {}
    if (!response.ok) throw new Error(data?.erro || "Falha na comunicação com o servidor");
    return data;
  } catch (error) {
    if (error instanceof TypeError) throw new Error("Não foi possível conectar à API. Verifique se o servidor está rodando.");
    throw error;
  }
}

const api = {
  login: body => request("/login", { method: "POST", body }),
  register: body => request("/usuarios", { method: "POST", body }),
  vehicles: id => request(`/veiculos/${id}`),
  createVehicle: body => request("/veiculos", { method: "POST", body }),
  updateVehicle: (id, body) => request(`/veiculos/${id}`, { method: "PUT", body }),
  deleteVehicle: id => request(`/veiculos/${id}`, { method: "DELETE" }),
  maintenance: id => request(`/manutencoes/usuario/${id}`),
  createMaintenance: body => request("/manutencoes", { method: "POST", body }),
  deleteMaintenance: id => request(`/manutencoes/${id}`, { method: "DELETE" }),
  alerts: id => request(`/alertas/${id}`)
};

let dataCache = null;
async function loadData(force = false) {
  const user = userSession.get();
  if (!user) return null;
  if (dataCache && !force) return dataCache;
  const [vehicles, alerts, maintenance] = await Promise.all([
    api.vehicles(user.id), api.alerts(user.id), api.maintenance(user.id)
  ]);
  const maintenanceByVehicle = new Map(vehicles.map(vehicle => [Number(vehicle.id), []]));
  maintenance.forEach(item => {
    const id = Number(item.veiculo_id);
    maintenanceByVehicle.get(id)?.push(item);
  });
  dataCache = { vehicles, alerts, maintenance, maintenanceByVehicle };
  return dataCache;
}
function invalidate() { dataCache = null; }

function isOil(title) {
  return String(title || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes("oleo");
}
function oilInfo(vehicle, maintenance) {
  const latest = (maintenance || []).filter(item => isOil(item.titulo))
    .sort((a, b) => Number(b.km_realizada) - Number(a.km_realizada))[0];
  if (!latest) return { status: "Informativo", text: "Registre a primeira troca de óleo", lastKm: null };
  const traveled = Number(vehicle.km || 0) - Number(latest.km_realizada);
  const remaining = 10000 - traveled;
  const status = traveled >= 10000 ? "Atrasada" : traveled >= 8000 ? "Atenção" : "Em dia";
  return {
    status,
    text: remaining < 0
      ? `Atrasada em ${formatKm(Math.abs(remaining))}`
      : status === "Atrasada" ? "Troca de óleo atrasada" : `Troca de óleo em ${formatKm(remaining)}`,
    lastKm: Number(latest.km_realizada)
  };
}
function vehicleStatus(alerts, vehicleId) {
  const related = (alerts || []).filter(alert => Number(alert.veiculo_id) === Number(vehicleId));
  if (related.some(alert => alert.tipo === "Manutenção Atrasada")) return "Atrasada";
  if (related.some(alert => alert.tipo === "Atenção")) return "Atenção";
  if (related.some(alert => alert.tipo === "Aviso")) return "Informativo";
  return "Em dia";
}
function pill(status) {
  const styles = {
    "Em dia": ["status-ok", "bi-check-circle"],
    "Atenção": ["status-attention", "bi-exclamation-triangle"],
    "Atrasada": ["status-late", "bi-clock"],
    "Informativo": ["status-info", "bi-info-circle"]
  };
  const [style, icon] = styles[status] || styles.Informativo;
  return `<span class="status-pill ${style}"><i class="bi ${icon}" aria-hidden="true"></i>${status}</span>`;
}
function notify(message) {
  byId("toastMessage").textContent = message;
  bootstrap.Toast.getOrCreateInstance(byId("appToast"), { delay: 2800 }).show();
}
function buttonLoading(button, loading, text = "Salvando...") {
  if (loading) {
    button.dataset.originalHtml = button.innerHTML;
    button.innerHTML = `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${text}`;
    button.disabled = true;
  } else {
    button.innerHTML = button.dataset.originalHtml || button.innerHTML;
    button.disabled = false;
  }
}

const authView = byId("authView");
const appView = byId("appView");
const page = byId("pageContent");
function showAuth() {
  authView.classList.remove("d-none");
  appView.classList.add("d-none");
}
function showAppShell() {
  authView.classList.add("d-none");
  appView.classList.remove("d-none");
  const user = userSession.get();
  const initial = user?.nome?.[0]?.toUpperCase() || "U";
  byId("sidebarName").textContent = user?.nome || "Usuário";
  byId("sidebarAvatar").textContent = initial;
  byId("topAvatar").textContent = initial;
}
function setBreadcrumb(text, model = "") {
  byId("breadcrumb").innerHTML = model
    ? `<ol class="breadcrumb mb-0"><li class="breadcrumb-item"><a href="#/garagem">Minha garagem</a></li><li class="breadcrumb-item active">${esc(model)}</li></ol>`
    : `<ol class="breadcrumb mb-0"><li class="breadcrumb-item active">${esc(text)}</li></ol>`;
}
function activateNav(name) {
  document.querySelectorAll("[data-route]").forEach(link => {
    const active = link.dataset.route === name;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}
function showError(error) {
  page.innerHTML = `<div class="soft-card empty-state"><i class="bi bi-exclamation-circle fs-1"></i><h2 class="fs-5 mt-2">Não foi possível carregar</h2><p>${esc(error.message || error)}</p><button class="btn btn-dark" id="retry">Tentar novamente</button></div>`;
  byId("retry").addEventListener("click", route);
}
function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
}

document.querySelectorAll("[data-auth-tab]").forEach(button => button.addEventListener("click", () => {
  const login = button.dataset.authTab === "login";
  document.querySelectorAll("[data-auth-tab]").forEach(item => item.classList.toggle("active", item === button));
  byId("loginForm").classList.toggle("d-none", !login);
  byId("registerForm").classList.toggle("d-none", login);
}));

byId("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const email = byId("loginEmail").value.trim();
  const senha = byId("loginPassword").value;
  const error = byId("loginError");
  error.classList.add("d-none");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || senha.length < 6) {
    error.textContent = "Informe um e-mail válido e uma senha com pelo menos 6 caracteres.";
    error.classList.remove("d-none");
    return;
  }
  const button = event.currentTarget.querySelector("[type=submit]");
  buttonLoading(button, true, "Entrando...");
  try {
    const result = await api.login({ email, senha });
    userSession.set(result.usuario);
    showAppShell();
    await route();
  } catch (e) {
    error.textContent = e.message;
    error.classList.remove("d-none");
  } finally { buttonLoading(button, false); }
});

byId("registerForm").addEventListener("submit", async event => {
  event.preventDefault();
  const nome = byId("registerName").value.trim();
  const email = byId("registerEmail").value.trim();
  const senha = byId("registerPassword").value;
  const error = byId("registerError");
  error.classList.add("d-none");
  if (!nome || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || senha.length < 6) {
    error.textContent = "Informe nome, e-mail válido e senha com pelo menos 6 caracteres.";
    error.classList.remove("d-none");
    return;
  }
  const button = event.currentTarget.querySelector("[type=submit]");
  buttonLoading(button, true, "Criando...");
  try {
    await api.register({ nome, email, senha });
    const result = await api.login({ email, senha });
    userSession.set(result.usuario);
    showAppShell();
    await route();
  } catch (e) {
    error.textContent = e.message;
    error.classList.remove("d-none");
  } finally { buttonLoading(button, false); }
});

async function renderDashboard() {
  const user = userSession.get();
  setBreadcrumb("Visão geral / Dashboard");
  activateNav("dashboard");
  page.innerHTML = `<div class="page-heading"><div><h1>${greeting()}, ${esc(user.nome.split(" ")[0])}.</h1><p>A saúde dos seus veículos em um só lugar.</p></div><button class="btn btn-dark" id="addVehicle"><i class="bi bi-plus-lg me-1"></i>Adicionar veículo</button></div><div class="row g-3"><div class="col-6 col-xl-3"><div class="soft-card p-3 skeleton"></div></div></div>`;
  try {
    const data = await loadData();
    const inDay = data.vehicles.filter(item => vehicleStatus(data.alerts, item.id) === "Em dia").length;
    const attention = data.vehicles.filter(item => ["Atenção", "Atrasada"].includes(vehicleStatus(data.alerts, item.id))).length;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    const spending = data.maintenance.filter(item => new Date(`${item.data_realizada}T00:00:00`) >= cutoff)
      .reduce((sum, item) => sum + Number(item.valor || 0), 0);
    page.innerHTML = `
      <div class="page-heading"><div><h1>${greeting()}, ${esc(user.nome.split(" ")[0])}.</h1><p>A saúde dos seus veículos em um só lugar.</p></div><button class="btn btn-dark" id="addVehicle"><i class="bi bi-plus-lg me-1"></i>Adicionar veículo</button></div>
      <div class="row g-3">
        <div class="col-6 col-xl-3"><div class="soft-card metric-card p-3"><small>Veículos cadastrados</small><strong>${data.vehicles.length}</strong></div></div>
        <div class="col-6 col-xl-3"><div class="soft-card metric-card p-3"><small>Manutenções em dia</small><strong>${inDay} de ${data.vehicles.length}</strong></div></div>
        <div class="col-6 col-xl-3"><div class="soft-card metric-card p-3"><small>Precisam de atenção</small><strong>${attention}</strong><small>ver alertas</small></div></div>
        <div class="col-6 col-xl-3"><div class="soft-card metric-card p-3"><small>Gastos no período</small><strong>${formatBrl(spending)}</strong><small>últimos 30 dias</small></div></div>
      </div>
      <div class="section-title"><h2>Acompanhe seus veículos</h2><a href="#/garagem" class="text-decoration-none small fw-bold text-dark">Visualizar garagem →</a></div>
      ${data.vehicles.length ? `<div class="row g-3">${data.vehicles.map(vehicle => {
        const oil = oilInfo(vehicle, data.maintenanceByVehicle.get(Number(vehicle.id)));
        return `<div class="col-md-6 col-xl-4"><a class="soft-card vehicle-card d-block p-3" href="#/veiculo/${vehicle.id}">
          <div class="vehicle-image mb-3"><i class="bi bi-car-front"></i></div>
          <div class="d-flex justify-content-between align-items-start gap-2"><h2>${esc(vehicle.marca)} ${esc(vehicle.modelo)}</h2>${pill(vehicleStatus(data.alerts, vehicle.id))}</div>
          <small class="text-secondary">${esc(vehicle.ano)} • ${esc(vehicle.placa)}</small><div class="km mt-2">${formatKm(vehicle.km)}</div><small class="text-secondary">${esc(oil.text)}</small>
        </a></div>`;
      }).join("")}</div>` : `<div class="soft-card empty-state"><i class="bi bi-car-front fs-1"></i><h2 class="fs-5 mt-2">Nenhum veículo cadastrado</h2><p>Adicione seu primeiro veículo para acompanhar a manutenção.</p><button class="btn btn-dark" id="emptyAddVehicle">Cadastrar veículo</button></div>`}
      <div class="section-title"><h2>Ações prioritárias</h2></div>
      ${data.alerts.length ? `<div class="row g-3">${data.alerts.map(alert => `<div class="col-md-6"><article class="soft-card p-3"><strong>${esc(alert.tipo)}</strong><p class="my-3">${esc(alert.mensagem)}</p><a class="text-dark fw-bold text-decoration-none small" href="#/veiculo/${alert.veiculo_id}">Ver veículo →</a></article></div>`).join("")}</div>` : `<div class="row g-3"><div class="col-md-6"><div class="soft-card p-3"><strong>✓ Tudo em dia</strong><p class="text-secondary mt-2 mb-0">Nenhum alerta exige atenção agora.</p></div></div><div class="col-md-6"><div class="soft-card p-3"><strong>Próximo passo</strong><p class="text-secondary mt-2 mb-0">Atualize a quilometragem dos seus veículos.</p></div></div></div>`}`;
    byId("addVehicle").addEventListener("click", openVehicleModal);
    byId("emptyAddVehicle")?.addEventListener("click", openVehicleModal);
  } catch (error) { showError(error); }
}

async function renderGarage() {
  setBreadcrumb("Minha garagem");
  activateNav("garagem");
  page.innerHTML = `<div class="page-heading"><div><h1>Minha garagem</h1><p>Todos os veículos que você acompanha.</p></div><button class="btn btn-dark" id="addVehicle"><i class="bi bi-plus-lg me-1"></i>Novo veículo</button></div>
    <div class="row g-3 mb-3"><div class="col-lg-8"><div class="input-group"><span class="input-group-text bg-white"><i class="bi bi-search"></i></span><input class="form-control" id="searchVehicle" placeholder="Buscar marca, modelo ou placa"></div></div>
    <div class="col-lg-4"><select class="form-select" id="filterStatus"><option value="">Todos os status</option><option>Em dia</option><option>Atenção</option><option>Atrasada</option><option>Informativo</option></select></div></div><div class="row g-3" id="vehicleGrid"></div>`;
  try {
    const data = await loadData();
    const render = () => {
      const search = byId("searchVehicle").value.trim().toLowerCase();
      const status = byId("filterStatus").value;
      const vehicles = data.vehicles.filter(item => {
        const matchesText = `${item.marca} ${item.modelo} ${item.placa}`.toLowerCase().includes(search);
        const matchesStatus = !status || vehicleStatus(data.alerts, item.id) === status;
        return matchesText && matchesStatus;
      });
      byId("vehicleGrid").innerHTML = vehicles.length ? vehicles.map(item => `<div class="col-md-6 col-xl-4"><a class="soft-card vehicle-card d-block p-3" href="#/veiculo/${item.id}">
        <div class="vehicle-image mb-3"><i class="bi bi-car-front"></i></div><div class="d-flex justify-content-between gap-2"><h2>${esc(item.marca)} ${esc(item.modelo)}</h2>${pill(vehicleStatus(data.alerts,item.id))}</div>
        <small class="text-secondary">${esc(item.ano)} • ${esc(item.placa)}</small><div class="km mt-2">${formatKm(item.km)}</div></a></div>`).join("")
        : `<div class="col-12"><div class="soft-card empty-state">Nenhum veículo encontrado.</div></div>`;
    };
    byId("addVehicle").addEventListener("click", openVehicleModal);
    byId("searchVehicle").addEventListener("input", render);
    byId("filterStatus").addEventListener("change", render);
    render();
  } catch (error) { showError(error); }
}

async function renderVehicle(id) {
  setBreadcrumb("Minha garagem");
  activateNav("garagem");
  try {
    const data = await loadData();
    const vehicle = data.vehicles.find(item => Number(item.id) === Number(id));
    if (!vehicle) {
      page.innerHTML = `<div class="soft-card empty-state"><h2 class="fs-5">Veículo não encontrado</h2><p>Este veículo não pertence à sua conta.</p><a class="btn btn-dark" href="#/garagem">Voltar à garagem</a></div>`;
      return;
    }
    const history = data.maintenanceByVehicle.get(Number(vehicle.id)) || [];
    const oil = oilInfo(vehicle, history);
    setBreadcrumb("", vehicle.modelo);
    page.innerHTML = `
      <div class="page-heading"><div><h1>${esc(vehicle.modelo)}</h1><p>${esc(vehicle.marca)} • ${esc(vehicle.ano)} • ${esc(vehicle.placa)}</p></div>${pill(vehicleStatus(data.alerts,vehicle.id))}</div>
      <div class="soft-card p-3"><div class="row g-3 align-items-center"><div class="col-md-5"><div class="vehicle-detail-image"><i class="bi bi-car-front"></i></div></div>
      <div class="col-md-7"><small class="text-secondary">Quilometragem atual</small><h2>${formatKm(vehicle.km)}</h2><button class="btn btn-outline-secondary" id="updateKm">Atualizar km</button><hr><small class="text-secondary">Próxima troca de óleo</small><h3 class="fs-5">${esc(oil.text)}</h3></div></div></div>
      <div class="section-title"><h2>Histórico de manutenção</h2><button class="btn btn-dark" id="addService">+ Registrar serviço</button></div>
      ${history.length ? `<div class="row g-3">${history.map(item => `<div class="col-md-6"><article class="soft-card p-3"><div class="d-flex justify-content-between gap-2"><strong>${esc(item.titulo)}</strong><small class="text-secondary">${formatDate(item.data_realizada)} • ${formatKm(item.km_realizada)}</small></div>${item.valor != null ? `<div class="fw-bold mt-2">${formatBrl(item.valor)}</div>` : ""}${item.descricao ? `<p class="text-secondary small mt-2">${esc(item.descricao)}</p>` : ""}<button class="btn btn-outline-danger btn-sm mt-2" data-delete-service="${item.id}"><i class="bi bi-trash"></i> Excluir</button></article></div>`).join("")}</div>` : `<div class="soft-card empty-state">Nenhum serviço registrado.</div>`}
      <div class="mt-4"><button class="btn btn-outline-danger" id="deleteVehicle"><i class="bi bi-trash"></i> Excluir veículo</button></div>`;
    byId("updateKm").addEventListener("click", () => openKmModal(vehicle));
    byId("addService").addEventListener("click", () => openServiceModal(vehicle.id));
    byId("deleteVehicle").addEventListener("click", () => confirmAction("Excluir este veículo e todo o seu histórico?", async () => {
      await api.deleteVehicle(vehicle.id); invalidate(); notify("Veículo excluído"); location.hash = "#/garagem";
    }));
    document.querySelectorAll("[data-delete-service]").forEach(button => button.addEventListener("click", () => confirmAction("Excluir esta manutenção?", async () => {
      await api.deleteMaintenance(button.dataset.deleteService); invalidate(); notify("Manutenção excluída"); await renderVehicle(vehicle.id);
    })));
  } catch (error) { showError(error); }
}

async function renderMaintenance() {
  setBreadcrumb("Manutenções");
  activateNav("manutencoes");
  page.innerHTML = `<div class="page-heading"><div><h1>Manutenções</h1><p>Histórico e planejamento dos serviços.</p></div><button class="btn btn-dark" id="addService">+ Registrar serviço</button></div>
    <ul class="nav nav-pills tab-pills mb-3"><li class="nav-item"><button class="nav-link active" data-tab="Todas">Todas</button></li><li class="nav-item"><button class="nav-link" data-tab="Realizadas">Realizadas</button></li><li class="nav-item"><button class="nav-link" data-tab="Próximas">Próximas</button></li><li class="nav-item"><button class="nav-link" data-tab="Atrasadas">Atrasadas</button></li></ul><div id="maintenanceRows"></div>`;
  try {
    const data = await loadData();
    byId("addService").addEventListener("click", () => openServiceModal());
    document.querySelectorAll("[data-tab]").forEach(button => button.addEventListener("click", () => {
      document.querySelectorAll("[data-tab]").forEach(item => item.classList.toggle("active", item === button));
      renderMaintenanceRows(button.dataset.tab, data);
    }));
    renderMaintenanceRows("Todas", data);
  } catch (error) { showError(error); }
}

function renderMaintenanceRows(tab, data) {
  let rows = [];
  if (tab === "Todas" || tab === "Realizadas") {
    rows = data.maintenance.map(item => ({
      service: item.titulo, vehicle: `${item.marca} ${item.modelo}`, plate: item.placa,
      date: formatDate(item.data_realizada), status: tab === "Todas" ? "Em dia" : "Informativo",
      value: formatBrl(item.valor)
    }));
  } else {
    data.vehicles.forEach(vehicle => {
      const info = oilInfo(vehicle, data.maintenanceByVehicle.get(Number(vehicle.id)));
      const late = info.status === "Atrasada";
      if (tab === "Atrasadas" && !late) return;
      if (tab === "Próximas" && (info.lastKm === null || late)) return;
      rows.push({ service: "Troca de óleo", vehicle: `${vehicle.marca} ${vehicle.modelo}`, plate: vehicle.placa, date: info.text, status: info.status, value: "" });
    });
  }
  byId("maintenanceRows").innerHTML = rows.length ? `<div class="table-responsive soft-card p-2"><table class="table maintenance-table mb-0"><thead><tr><th>Serviço</th><th>Veículo</th><th>Vencimento/Data</th><th>Status</th><th>Valor</th></tr></thead><tbody>${rows.map(row => `<tr><td data-label="Serviço">${esc(row.service)}</td><td data-label="Veículo">${esc(row.vehicle)}<br><small>${esc(row.plate)}</small></td><td data-label="Vencimento/Data">${esc(row.date)}</td><td data-label="Status">${pill(row.status)}</td><td data-label="Valor">${esc(row.value)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="soft-card empty-state">Nenhuma manutenção nesta categoria.</div>`;
}

async function renderAlerts() {
  setBreadcrumb("Alertas");
  activateNav("alertas");
  try {
    const data = await loadData();
    if (!data.alerts.length) {
      page.innerHTML = `<div class="page-heading"><div><h1>Alertas</h1><p>Acompanhe os cuidados dos seus veículos.</p></div></div><div class="soft-card empty-state"><i class="bi bi-check-circle fs-1"></i><h2 class="fs-5 mt-2">Tudo em dia</h2><p>Não há alertas para seus veículos.</p></div>`;
      return;
    }
    const cards = data.alerts.map(alert => {
      const vehicle = data.vehicles.find(item => Number(item.id) === Number(alert.veiculo_id));
      const history = data.maintenanceByVehicle.get(Number(alert.veiculo_id)) || [];
      const last = history.filter(item => isOil(item.titulo)).sort((a,b) => Number(b.km_realizada)-Number(a.km_realizada))[0];
      const traveled = vehicle && last ? Number(vehicle.km) - Number(last.km_realizada) : null;
      const status = alert.tipo === "Manutenção Atrasada" ? "Atrasada" : alert.tipo === "Atenção" ? "Atenção" : "Informativo";
      return `<div class="col-md-6"><article class="soft-card p-3 h-100">${pill(status)}<h2 class="fs-5 mt-3">${esc(alert.modelo)}</h2><p>${esc(alert.mensagem)}</p>${vehicle ? `<p class="text-secondary small">KM atual: ${formatKm(vehicle.km)}${last ? ` • Última troca: ${formatKm(last.km_realizada)} • Intervalo: 10.000 km • Percorrido: ${formatKm(traveled)}` : " • Nenhuma troca de óleo registrada"}</p><a class="text-dark fw-bold text-decoration-none small" href="#/veiculo/${vehicle.id}">Ver veículo →</a>` : ""}</article></div>`;
    }).join("");
    page.innerHTML = `<div class="page-heading"><div><h1>Alertas</h1><p>Acompanhe os cuidados dos seus veículos.</p></div></div><div class="row g-3">${cards}</div>`;
  } catch (error) { showError(error); }
}

function renderSettings() {
  setBreadcrumb("Configurações");
  activateNav("configuracoes");
  const user = userSession.get();
  page.innerHTML = `<div class="page-heading"><div><h1>Configurações</h1><p>Dados da sua conta.</p></div></div><section class="soft-card p-4" style="max-width:640px"><h2 class="fs-5">Perfil</h2><div class="mt-3 mb-3"><label class="form-label">Nome</label><input class="form-control" value="${esc(user.nome)}" readonly></div><div class="mb-3"><label class="form-label">E-mail</label><input class="form-control" value="${esc(user.email)}" readonly></div><button class="btn btn-dark" id="logout">Sair</button></section>`;
  byId("logout").addEventListener("click", () => { userSession.clear(); invalidate(); location.hash = ""; showAuth(); });
}

async function openVehicleModal() {
  const form = byId("vehicleForm");
  form.reset();
  byId("vehicleError").classList.add("d-none");
  byId("fipeWarning").classList.add("d-none");
  byId("fipeFields").classList.remove("d-none");
  byId("manualFields").classList.add("d-none");
  const brand = byId("vehicleBrand"), model = byId("vehicleModel"), year = byId("vehicleYear");
  brand.disabled = true; brand.innerHTML = `<option>Carregando marcas...</option>`;
  model.disabled = true; model.innerHTML = `<option value="">Selecione a marca</option>`;
  year.disabled = true; year.innerHTML = `<option value="">Selecione o modelo</option>`;
  bootstrap.Modal.getOrCreateInstance(byId("vehicleModal")).show();
  try {
    const response = await fetch(`${FIPE}/marcas`);
    if (!response.ok) throw new Error("FIPE indisponível");
    const brands = await response.json();
    brand.disabled = false;
    brand.innerHTML = `<option value="">Selecione a marca</option>${brands.map(item => `<option value="${item.codigo}" data-name="${esc(item.nome)}">${esc(item.nome)}</option>`).join("")}`;
  } catch { showManualVehicleFields(); }
  brand.onchange = async () => {
    model.disabled = true; year.disabled = true;
    try {
      const response = await fetch(`${FIPE}/marcas/${brand.value}/modelos`);
      if (!response.ok) throw new Error();
      const result = await response.json();
      model.innerHTML = `<option value="">Selecione o modelo</option>${result.modelos.map(item => `<option value="${item.codigo}" data-name="${esc(item.nome)}">${esc(item.nome)}</option>`).join("")}`;
      model.disabled = false;
    } catch { showManualVehicleFields(); }
  };
  model.onchange = async () => {
    year.disabled = true;
    try {
      const response = await fetch(`${FIPE}/marcas/${brand.value}/modelos/${model.value}/anos`);
      if (!response.ok) throw new Error();
      const years = await response.json();
      year.innerHTML = `<option value="">Selecione o ano</option>${years.map(item => `<option value="${esc(item.nome)}">${esc(item.nome)}</option>`).join("")}`;
      year.disabled = false;
    } catch { showManualVehicleFields(); }
  };
}
function showManualVehicleFields() {
  byId("fipeFields").classList.add("d-none");
  byId("manualFields").classList.remove("d-none");
  byId("fipeWarning").classList.remove("d-none");
}

byId("vehicleForm").addEventListener("submit", async event => {
  event.preventDefault();
  const manual = !byId("manualFields").classList.contains("d-none");
  const brand = manual ? byId("manualBrand").value.trim() : byId("vehicleBrand").selectedOptions[0]?.dataset.name || "";
  const model = manual ? byId("manualModel").value.trim() : byId("vehicleModel").selectedOptions[0]?.dataset.name || "";
  const yearValue = manual ? byId("manualYear").value : byId("vehicleYear").value;
  const year = /^\d{4}/.test(yearValue) ? Number(yearValue.slice(0, 4)) : Number(yearValue);
  const mileage = Number(byId("vehicleKm").value);
  const error = byId("vehicleError");
  error.classList.add("d-none");
  if (!brand || !model || !byId("vehiclePlate").value.trim() || !Number.isFinite(year) || year < 0 || !Number.isFinite(mileage) || mileage < 0) {
    error.textContent = "Preencha os campos com valores válidos.";
    error.classList.remove("d-none");
    return;
  }
  const button = event.currentTarget.querySelector("[type=submit]");
  buttonLoading(button, true);
  try {
    await api.createVehicle({ usuario_id: userSession.get().id, marca: brand, modelo: model, ano: year, placa: byId("vehiclePlate").value.trim(), km: mileage });
    bootstrap.Modal.getInstance(byId("vehicleModal")).hide();
    invalidate(); notify("Veículo cadastrado"); await route();
  } catch (e) {
    error.textContent = e.message; error.classList.remove("d-none");
  } finally { buttonLoading(button, false); }
});

async function openServiceModal(fixedVehicleId) {
  const data = await loadData();
  if (!data.vehicles.length) { notify("Cadastre um veículo primeiro."); return; }
  const fixed = fixedVehicleId ? data.vehicles.find(item => Number(item.id) === Number(fixedVehicleId)) : null;
  const form = byId("serviceForm");
  form.reset();
  byId("serviceError").classList.add("d-none");
  byId("otherServiceWrap").classList.add("d-none");
  byId("serviceDate").value = today();
  byId("serviceVehicleWrap").classList.toggle("d-none", Boolean(fixed));
  byId("serviceVehicle").innerHTML = data.vehicles.map(item => `<option value="${item.id}">${esc(item.marca)} ${esc(item.modelo)} • ${esc(item.placa)}</option>`).join("");
  const initial = fixed || data.vehicles[0];
  byId("serviceVehicle").value = initial.id;
  byId("serviceKm").value = initial.km || 0;
  byId("serviceValue").value = "0";
  bootstrap.Modal.getOrCreateInstance(byId("serviceModal")).show();
  byId("serviceVehicle").onchange = () => {
    const selected = data.vehicles.find(item => Number(item.id) === Number(byId("serviceVehicle").value));
    byId("serviceKm").value = selected?.km || 0;
  };
  byId("serviceTitle").onchange = () => byId("otherServiceWrap").classList.toggle("d-none", byId("serviceTitle").value !== "Outro");
}

byId("serviceForm").addEventListener("submit", async event => {
  event.preventDefault();
  const data = await loadData();
  const vehicle = data.vehicles.find(item => Number(item.id) === Number(byId("serviceVehicle").value));
  const select = byId("serviceTitle");
  const title = select.value === "Outro" ? byId("otherService").value.trim() : select.value;
  const mileage = Number(byId("serviceKm").value), value = Number(byId("serviceValue").value);
  const error = byId("serviceError");
  error.classList.add("d-none");
  if (!vehicle || !title || !byId("serviceDate").value || !Number.isFinite(mileage) || mileage < 0 || !Number.isFinite(value) || value < 0) {
    error.textContent = "Verifique o serviço, a data, a quilometragem e o valor.";
    error.classList.remove("d-none");
    return;
  }
  const button = event.currentTarget.querySelector("[type=submit]");
  buttonLoading(button, true);
  try {
    await api.createMaintenance({
      veiculo_id: vehicle.id, titulo: title, descricao: byId("serviceDescription").value.trim(),
      data_realizada: byId("serviceDate").value, km_realizada: mileage, valor: value
    });
    if (mileage > Number(vehicle.km || 0)) await api.updateVehicle(vehicle.id, { km: mileage });
    bootstrap.Modal.getInstance(byId("serviceModal")).hide();
    invalidate(); notify("Manutenção registrada"); await route();
  } catch (e) {
    error.textContent = e.message; error.classList.remove("d-none");
  } finally { buttonLoading(button, false); }
});

function openKmModal(vehicle) {
  byId("kmForm").reset();
  byId("kmError").classList.add("d-none");
  byId("newKm").min = Number(vehicle.km || 0);
  byId("newKm").value = Number(vehicle.km || 0);
  bootstrap.Modal.getOrCreateInstance(byId("kmModal")).show();
  byId("kmForm").onsubmit = async event => {
    event.preventDefault();
    const value = Number(byId("newKm").value), error = byId("kmError");
    error.classList.add("d-none");
    if (!Number.isFinite(value) || value < Number(vehicle.km || 0)) {
      error.textContent = "A quilometragem não pode ser menor que a atual."; error.classList.remove("d-none"); return;
    }
    const button = event.currentTarget.querySelector("[type=submit]");
    buttonLoading(button, true);
    try {
      await api.updateVehicle(vehicle.id, { km: value });
      bootstrap.Modal.getInstance(byId("kmModal")).hide();
      invalidate(); notify("Quilometragem atualizada"); await renderVehicle(vehicle.id);
    } catch (e) { error.textContent = e.message; error.classList.remove("d-none"); }
    finally { buttonLoading(button, false); }
  };
}

function confirmAction(message, action) {
  return new Promise(resolve => {
    let confirmed = false;
    const modalElement = byId("confirmModal");
    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
    byId("confirmMessage").textContent = message;
    const button = byId("confirmAction");
    button.onclick = async () => {
      button.disabled = true;
      try {
        await action();
        confirmed = true;
        modal.hide();
      } catch (error) { notify(error.message); }
      finally { button.disabled = false; }
    };
    modalElement.addEventListener("hidden.bs.modal", () => resolve(confirmed), { once: true });
    modal.show();
  });
}

function renderSettings() {
  setBreadcrumb("Configurações");
  activateNav("configuracoes");
  const user = userSession.get();
  page.innerHTML = `<div class="page-heading"><div><h1>Configurações</h1><p>Dados da sua conta.</p></div></div><section class="soft-card p-4" style="max-width:640px"><h2 class="fs-5">Perfil</h2><div class="mt-3 mb-3"><label class="form-label">Nome</label><input class="form-control" value="${esc(user.nome)}" readonly></div><div class="mb-3"><label class="form-label">E-mail</label><input class="form-control" value="${esc(user.email)}" readonly></div><button class="btn btn-dark" id="logout">Sair</button></section>`;
  byId("logout").addEventListener("click", () => { userSession.clear(); invalidate(); location.hash = ""; showAuth(); });
}

async function route() {
  if (!userSession.get()) { showAuth(); return; }
  showAppShell();
  const [name, id] = location.hash.replace(/^#\/?/, "").split("/");
  try {
    if (!name || name === "dashboard") return await renderDashboard();
    if (name === "garagem") return await renderGarage();
    if (name === "veiculo") return await renderVehicle(id);
    if (name === "manutencoes") return await renderMaintenance();
    if (name === "alertas") return await renderAlerts();
    if (name === "configuracoes") return renderSettings();
    location.hash = "#/dashboard";
  } catch (error) { showError(error); }
}

document.querySelectorAll(".mobile-nav a, #mobileMenu a").forEach(link => link.addEventListener("click", () => {
  const menu = bootstrap.Offcanvas.getInstance(byId("mobileMenu"));
  menu?.hide();
}));

window.addEventListener("hashchange", route);
if (userSession.get()) {
  showAppShell();
  route();
} else showAuth();
