import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Download,
  Upload,
  Plus,
  Search,
  Car,
  Users,
  Wrench,
  LayoutDashboard,
  FileText,
  CheckCircle2,
  Pencil,
  Save,
  X,
  CalendarDays,
  DollarSign,
} from "lucide-react";
import jsPDF from "jspdf";

const STORAGE_KEY = "jpbr-auto-app-mobile-final";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
});

const todayISO = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);

const initialData = {
  services: [
    { id: uid(), name: "Troca de óleo", defaultPrice: 80 },
    { id: uid(), name: "Polimento", defaultPrice: 150 },
    { id: uid(), name: "Lavagem completa", defaultPrice: 60 },
  ],
  clients: [],
  cars: [],
  launches: [],
};

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialData;
    const parsed = JSON.parse(raw);
    return {
      services: parsed.services || [],
      clients: parsed.clients || [],
      cars: parsed.cars || [],
      launches: parsed.launches || [],
    };
  } catch {
    return initialData;
  }
}

function fileNameSafeDate() {
  return new Date().toISOString().slice(0, 10);
}

function App() {
  const fileInputRef = useRef(null);

  const [data, setData] = useState(initialData);
  const [tab, setTab] = useState("dashboard");
  const [searchPlate, setSearchPlate] = useState("");
  const [saveMessage, setSaveMessage] = useState("Dados salvos neste aparelho.");

  const [serviceForm, setServiceForm] = useState({ name: "", defaultPrice: "" });

  const [clientForm, setClientForm] = useState({
    id: "",
    name: "",
    phone: "",
    pricing: [],
  });

  const [carForm, setCarForm] = useState({
    plate: "",
    model: "",
    color: "",
    clientId: "",
  });

  const [launchForm, setLaunchForm] = useState({
    date: todayISO(),
    plate: "",
    carId: "",
    clientId: "",
    serviceId: "",
    value: "",
    paid: false,
    notes: "",
  });

  const [reportFilter, setReportFilter] = useState({
    startDate: todayISO(),
    endDate: todayISO(),
    clientId: "",
    paid: "all",
  });

  useEffect(() => {
    setData(loadData());
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setSaveMessage(
      `Dados salvos neste aparelho às ${new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })}.`
    );
  }, [data]);

  const clientsById = useMemo(
    () => Object.fromEntries(data.clients.map((c) => [c.id, c])),
    [data.clients]
  );

  const carsById = useMemo(
    () => Object.fromEntries(data.cars.map((c) => [c.id, c])),
    [data.cars]
  );

  const servicesById = useMemo(
    () => Object.fromEntries(data.services.map((s) => [s.id, s])),
    [data.services]
  );

  const filteredCars = useMemo(() => {
    const q = searchPlate.trim().toUpperCase();
    if (!q) return data.cars;
    return data.cars.filter((c) => c.plate.toUpperCase().includes(q));
  }, [data.cars, searchPlate]);

  const dashboardStats = useMemo(() => {
    const totalToday = data.launches
      .filter((l) => l.date === todayISO())
      .reduce((sum, item) => sum + Number(item.value || 0), 0);

    const totalOpen = data.launches
      .filter((l) => !l.paid)
      .reduce((sum, item) => sum + Number(item.value || 0), 0);

    const totalPaid = data.launches
      .filter((l) => l.paid)
      .reduce((sum, item) => sum + Number(item.value || 0), 0);

    return {
      clients: data.clients.length,
      cars: data.cars.length,
      services: data.services.length,
      today: totalToday,
      totalOpen,
      totalPaid,
    };
  }, [data]);

  const reportRows = useMemo(() => {
    return data.launches.filter((item) => {
      const afterStart = !reportFilter.startDate || item.date >= reportFilter.startDate;
      const beforeEnd = !reportFilter.endDate || item.date <= reportFilter.endDate;
      const clientMatch = !reportFilter.clientId || item.clientId === reportFilter.clientId;
      const paidMatch =
        reportFilter.paid === "all" ||
        (reportFilter.paid === "paid" && item.paid) ||
        (reportFilter.paid === "open" && !item.paid);

      return afterStart && beforeEnd && clientMatch && paidMatch;
    });
  }, [data.launches, reportFilter]);

  const reportSummary = useMemo(() => {
    const total = reportRows.reduce((sum, item) => sum + Number(item.value || 0), 0);
    const paid = reportRows
      .filter((r) => r.paid)
      .reduce((sum, item) => sum + Number(item.value || 0), 0);
    const open = reportRows
      .filter((r) => !r.paid)
      .reduce((sum, item) => sum + Number(item.value || 0), 0);

    return { total, paid, open, count: reportRows.length };
  }, [reportRows]);

  const availableServicesForClient = useMemo(() => {
    const client = data.clients.find((c) => c.id === launchForm.clientId);
    if (!client) return data.services;
    if (!client.pricing?.length) return data.services;

    return client.pricing
      .map((p) => data.services.find((s) => s.id === p.serviceId))
      .filter(Boolean);
  }, [data.clients, data.services, launchForm.clientId]);

  function addService(e) {
    e.preventDefault();
    if (!serviceForm.name.trim()) return;

    const next = {
      id: uid(),
      name: serviceForm.name.trim(),
      defaultPrice: Number(serviceForm.defaultPrice || 0),
    };

    setData((prev) => ({ ...prev, services: [...prev.services, next] }));
    setServiceForm({ name: "", defaultPrice: "" });
  }

  function toggleClientPricing(serviceId) {
    setClientForm((prev) => {
      const exists = prev.pricing.find((p) => p.serviceId === serviceId);

      if (exists) {
        return {
          ...prev,
          pricing: prev.pricing.filter((p) => p.serviceId !== serviceId),
        };
      }

      const service = data.services.find((s) => s.id === serviceId);
      return {
        ...prev,
        pricing: [...prev.pricing, { serviceId, price: service?.defaultPrice ?? 0 }],
      };
    });
  }

  function updateClientPrice(serviceId, price) {
    setClientForm((prev) => ({
      ...prev,
      pricing: prev.pricing.map((p) =>
        p.serviceId === serviceId ? { ...p, price } : p
      ),
    }));
  }

  function editClient(client) {
    setClientForm({
      id: client.id,
      name: client.name || "",
      phone: client.phone || "",
      pricing: (client.pricing || []).map((p) => ({
        ...p,
        price: Number(p.price || 0),
      })),
    });
    setTab("clients");
  }

  function resetClientForm() {
    setClientForm({ id: "", name: "", phone: "", pricing: [] });
  }

  function addClient(e) {
    e.preventDefault();
    if (!clientForm.name.trim()) return;

    const payload = {
      id: clientForm.id || uid(),
      name: clientForm.name.trim(),
      phone: clientForm.phone.trim(),
      pricing: clientForm.pricing.map((p) => ({
        ...p,
        price: Number(p.price || 0),
      })),
    };

    setData((prev) => {
      if (clientForm.id) {
        return {
          ...prev,
          clients: prev.clients.map((client) =>
            client.id === clientForm.id ? payload : client
          ),
        };
      }
      return { ...prev, clients: [...prev.clients, payload] };
    });

    resetClientForm();
  }

  function addCar(e) {
    e.preventDefault();
    if (!carForm.plate.trim() || !carForm.clientId) return;

    const next = {
      id: uid(),
      plate: carForm.plate.trim().toUpperCase(),
      model: carForm.model.trim(),
      color: carForm.color.trim(),
      clientId: carForm.clientId,
    };

    setData((prev) => ({ ...prev, cars: [...prev.cars, next] }));
    setCarForm({ plate: "", model: "", color: "", clientId: "" });
  }

  function handlePlateChange(plate) {
    const normalized = plate.toUpperCase();
    const car = data.cars.find((c) => c.plate.toUpperCase() === normalized);

    setLaunchForm((prev) => ({
      ...prev,
      plate: normalized,
      carId: car?.id || "",
      clientId: car?.clientId || "",
      serviceId: "",
      value: "",
    }));
  }

  function handleLaunchService(serviceId) {
    const client = data.clients.find((c) => c.id === launchForm.clientId);
    const service = data.services.find((s) => s.id === serviceId);
    const custom = client?.pricing?.find((p) => p.serviceId === serviceId);
    const price = custom?.price ?? service?.defaultPrice ?? 0;

    setLaunchForm((prev) => ({
      ...prev,
      serviceId,
      value: price,
    }));
  }

  function addLaunch(e) {
    e.preventDefault();
    if (!launchForm.date || !launchForm.plate || !launchForm.serviceId) return;

    const existingCar = data.cars.find(
      (c) =>
        c.id === launchForm.carId ||
        c.plate.toUpperCase() === launchForm.plate.toUpperCase()
    );

    const next = {
      id: uid(),
      date: launchForm.date,
      plate: launchForm.plate.toUpperCase(),
      carId: existingCar?.id || "",
      clientId: launchForm.clientId || existingCar?.clientId || "",
      serviceId: launchForm.serviceId,
      value: Number(launchForm.value || 0),
      paid: Boolean(launchForm.paid),
      notes: launchForm.notes.trim(),
      createdAt: new Date().toISOString(),
    };

    setData((prev) => ({ ...prev, launches: [next, ...prev.launches] }));

    setLaunchForm({
      date: todayISO(),
      plate: "",
      carId: "",
      clientId: "",
      serviceId: "",
      value: "",
      paid: false,
      notes: "",
    });
  }

  function togglePaid(id) {
    setData((prev) => ({
      ...prev,
      launches: prev.launches.map((item) =>
        item.id === id ? { ...item, paid: !item.paid } : item
      ),
    }));
  }

  function exportBackup() {
    const backup = {
      exportedAt: new Date().toISOString(),
      app: "JP BR Auto",
      version: 1,
      data,
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `backup-jp-br-auto-${fileNameSafeDate()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }

  function importBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        const incoming = parsed.data || parsed;

        setData({
          services: Array.isArray(incoming.services) ? incoming.services : [],
          clients: Array.isArray(incoming.clients) ? incoming.clients : [],
          cars: Array.isArray(incoming.cars) ? incoming.cars : [],
          launches: Array.isArray(incoming.launches) ? incoming.launches : [],
        });

        alert("Backup importado com sucesso.");
      } catch (error) {
        console.error(error);
        alert("Arquivo de backup inválido.");
      }
    };

    reader.readAsText(file);
    event.target.value = "";
  }

  function buildReportPdf() {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    let y = 48;

    const periodText = `${reportFilter.startDate || "início"} até ${
      reportFilter.endDate || "fim"
    }`;

    const drawBox = (x, top, w, h, title, value) => {
      doc.setDrawColor(220, 226, 232);
      doc.roundedRect(x, top, w, h, 10, 10);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(title, x + 12, top + 18);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(String(value), x + 12, top + 42);
    };

    const ensureSpace = (needed = 24) => {
      if (y + needed > pageHeight - 40) {
        doc.addPage();
        y = 48;
      }
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("Relatório JP BR Auto", margin, y);
    y += 24;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Período: ${periodText}`, margin, y);
    y += 10;
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, margin, y);
    y += 28;

    const gap = 12;
    const boxWidth = (pageWidth - margin * 2 - gap) / 2;

    drawBox(margin, y, boxWidth, 58, "Lançamentos", reportSummary.count);
    drawBox(
      margin + boxWidth + gap,
      y,
      boxWidth,
      58,
      "Total",
      currency.format(reportSummary.total)
    );
    y += 70;

    drawBox(margin, y, boxWidth, 58, "Pago", currency.format(reportSummary.paid));
    drawBox(
      margin + boxWidth + gap,
      y,
      boxWidth,
      58,
      "Em aberto",
      currency.format(reportSummary.open)
    );
    y += 84;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Detalhes dos serviços", margin, y);
    y += 18;

    if (reportRows.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(
        "Nenhum lançamento encontrado com os filtros selecionados.",
        margin,
        y
      );
    } else {
      reportRows.forEach((item, index) => {
        const client = clientsById[item.clientId];
        const car = carsById[item.carId];
        const service = servicesById[item.serviceId];
        const notes = item.notes || "Sem observações";

        const lines = [
          `${index + 1}. ${item.date} · ${service?.name || "Serviço"}`,
          `Cliente: ${client?.name || "Sem cliente"}`,
          `Telefone: ${client?.phone || "-"}`,
          `Placa: ${item.plate} · Carro: ${car?.model || "-"}`,
          `Valor: ${currency.format(item.value)} · Status: ${
            item.paid ? "Pago" : "Em aberto"
          }`,
          `Observações: ${notes}`,
        ];

        const wrapped = lines.flatMap((line) =>
          doc.splitTextToSize(line, pageWidth - margin * 2 - 16)
        );

        const blockHeight = wrapped.length * 14 + 18;
        ensureSpace(blockHeight + 10);

        doc.setDrawColor(220, 226, 232);
        doc.roundedRect(
          margin,
          y - 2,
          pageWidth - margin * 2,
          blockHeight,
          10,
          10
        );

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10.5);

        let lineY = y + 14;
        wrapped.forEach((line) => {
          doc.text(line, margin + 12, lineY);
          lineY += 14;
        });

        y += blockHeight + 10;
      });
    }

    return doc;
  }

  async function generateReportPdf() {
    try {
      const doc = buildReportPdf();
      const fileName = `relatorio-jp-br-auto-${fileNameSafeDate()}.pdf`;
      const pdfBlob = doc.output("blob");
      const pdfFile = new File([pdfBlob], fileName, {
        type: "application/pdf",
      });

      if (navigator.share && navigator.canShare?.({ files: [pdfFile] })) {
        await navigator.share({
          title: "Relatório JP BR Auto",
          text: "Segue o relatório em PDF.",
          files: [pdfFile],
        });
        return;
      }

      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    } catch (error) {
      console.error(error);
      alert("Não foi possível gerar o PDF neste momento.");
    }
  }

  const tabs = [
    { key: "dashboard", label: "Início", icon: LayoutDashboard },
    { key: "services", label: "Serviços", icon: Wrench },
    { key: "clients", label: "Clientes", icon: Users },
    { key: "cars", label: "Carros", icon: Car },
    { key: "launches", label: "Lançar", icon: Plus },
    { key: "reports", label: "Relatórios", icon: FileText },
  ];

  return (
    <div className="app">
      <style>{styles}</style>

      <header className="topbar">
        <div className="topbar-card">
          <div className="brand">JP BR Auto</div>
          <div className="subtitle">
            Cadastro de clientes, carros, serviços, lançamentos e relatórios.
          </div>

          <div className="save-badge">
            <CheckCircle2 size={14} />
            <span>{saveMessage}</span>
          </div>
        </div>

        <div className="top-actions">
          <button type="button" className="secondary-btn" onClick={exportBackup}>
            <Download size={18} />
            Backup
          </button>

          <button
            type="button"
            className="secondary-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={18} />
            Importar
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={importBackup}
          />
        </div>
      </header>

      <main className="container">
        {tab === "dashboard" && (
          <Section title="Visão geral" subtitle="Resumo rápido do dia e do financeiro.">
            <div className="stats-grid">
              <StatCard title="Clientes" value={dashboardStats.clients} icon={<Users size={18} />} />
              <StatCard title="Carros" value={dashboardStats.cars} icon={<Car size={18} />} />
              <StatCard title="Serviços" value={dashboardStats.services} icon={<Wrench size={18} />} />
              <StatCard title="Hoje" value={currency.format(dashboardStats.today)} icon={<CalendarDays size={18} />} />
              <StatCard title="Pago" value={currency.format(dashboardStats.totalPaid)} icon={<CheckCircle2 size={18} />} />
              <StatCard title="Em aberto" value={currency.format(dashboardStats.totalOpen)} icon={<DollarSign size={18} />} />
            </div>
          </Section>
        )}

        {tab === "services" && (
          <Section title="Serviços" subtitle="Cadastre os serviços e seus valores padrão.">
            <div className="layout-grid">
              <Card>
                <form onSubmit={addService} className="stack">
                  <Input
                    label="Nome do serviço"
                    value={serviceForm.name}
                    onChange={(e) =>
                      setServiceForm((p) => ({ ...p, name: e.target.value }))
                    }
                  />
                  <Input
                    label="Valor padrão"
                    type="number"
                    step="0.01"
                    value={serviceForm.defaultPrice}
                    onChange={(e) =>
                      setServiceForm((p) => ({
                        ...p,
                        defaultPrice: e.target.value,
                      }))
                    }
                  />
                  <PrimaryButton>Salvar serviço</PrimaryButton>
                </form>
              </Card>

              <Card>
                <div className="mobile-list">
                  {data.services.map((service) => (
                    <div className="mobile-row" key={service.id}>
                      <div>
                        <div className="row-title">{service.name}</div>
                        <div className="row-subtitle">Valor padrão</div>
                      </div>
                      <div className="row-value">
                        {currency.format(service.defaultPrice || 0)}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </Section>
        )}

        {tab === "clients" && (
          <Section
            title="Clientes"
            subtitle="Defina valores personalizados por serviço para cada cliente."
          >
            <div className="layout-grid wide">
              <Card>
                <form onSubmit={addClient} className="stack">
                  {clientForm.id && (
                    <div className="edit-banner">
                      <span>Editando cliente e preços personalizados.</span>
                      <Save size={16} />
                    </div>
                  )}

                  <Input
                    label="Nome do cliente"
                    value={clientForm.name}
                    onChange={(e) =>
                      setClientForm((p) => ({ ...p, name: e.target.value }))
                    }
                  />

                  <Input
                    label="Telefone"
                    value={clientForm.phone}
                    onChange={(e) =>
                      setClientForm((p) => ({ ...p, phone: e.target.value }))
                    }
                  />

                  <div className="stack">
                    <div className="section-mini-title">Serviços vinculados</div>

                    <div className="service-box">
                      {data.services.length === 0 && (
                        <div className="empty-inline">Cadastre serviços primeiro.</div>
                      )}

                      {data.services.map((service) => {
                        const selected = clientForm.pricing.find(
                          (p) => p.serviceId === service.id
                        );

                        return (
                          <div key={service.id} className="service-item">
                            <div className="service-header">
                              <label className="check-row">
                                <input
                                  type="checkbox"
                                  checked={Boolean(selected)}
                                  onChange={() => toggleClientPricing(service.id)}
                                />
                                <span>{service.name}</span>
                              </label>
                              <span className="muted-small">
                                Padrão: {currency.format(service.defaultPrice || 0)}
                              </span>
                            </div>

                            {selected && (
                              <div style={{ marginTop: 10 }}>
                                <Input
                                  label="Valor para este cliente"
                                  type="number"
                                  step="0.01"
                                  value={selected.price}
                                  onChange={(e) =>
                                    updateClientPrice(service.id, e.target.value)
                                  }
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="action-grid">
                    <PrimaryButton>
                      {clientForm.id ? "Atualizar cliente" : "Salvar cliente"}
                    </PrimaryButton>

                    {clientForm.id && (
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={resetClientForm}
                      >
                        <X size={16} />
                        Cancelar edição
                      </button>
                    )}
                  </div>
                </form>
              </Card>

              <Card>
                <div className="stack">
                  {data.clients.map((client) => (
                    <div className="client-card" key={client.id}>
                      <div className="client-top">
                        <div>
                          <div className="row-title">{client.name}</div>
                          <div className="row-subtitle">
                            {client.phone || "Sem telefone"}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="chip-btn"
                          onClick={() => editClient(client)}
                        >
                          <Pencil size={14} />
                          Editar
                        </button>
                      </div>

                      <div className="chips">
                        {(client.pricing || []).map((pricing) => (
                          <span key={pricing.serviceId} className="chip dark">
                            {servicesById[pricing.serviceId]?.name} ·{" "}
                            {currency.format(pricing.price || 0)}
                          </span>
                        ))}
                        {(!client.pricing || client.pricing.length === 0) && (
                          <span className="chip">Sem serviços vinculados</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </Section>
        )}

        {tab === "cars" && (
          <Section title="Carros" subtitle="Cadastre a placa e vincule ao cliente.">
            <div className="layout-grid">
              <Card>
                <form onSubmit={addCar} className="stack">
                  <Input
                    label="Placa"
                    value={carForm.plate}
                    onChange={(e) =>
                      setCarForm((p) => ({
                        ...p,
                        plate: e.target.value.toUpperCase(),
                      }))
                    }
                  />
                  <Input
                    label="Modelo"
                    value={carForm.model}
                    onChange={(e) =>
                      setCarForm((p) => ({ ...p, model: e.target.value }))
                    }
                  />
                  <Input
                    label="Cor"
                    value={carForm.color}
                    onChange={(e) =>
                      setCarForm((p) => ({ ...p, color: e.target.value }))
                    }
                  />
                  <Select
                    label="Cliente"
                    value={carForm.clientId}
                    onChange={(e) =>
                      setCarForm((p) => ({ ...p, clientId: e.target.value }))
                    }
                    options={[
                      { value: "", label: "Selecione" },
                      ...data.clients.map((c) => ({ value: c.id, label: c.name })),
                    ]}
                  />
                  <PrimaryButton>Salvar carro</PrimaryButton>
                </form>
              </Card>

              <Card>
                <div className="search-wrap">
                  <Search size={18} />
                  <input
                    value={searchPlate}
                    onChange={(e) => setSearchPlate(e.target.value)}
                    placeholder="Buscar por placa"
                    className="search-input"
                  />
                </div>

                <div className="mobile-list">
                  {filteredCars.map((car) => (
                    <div className="mobile-row" key={car.id}>
                      <div>
                        <div className="row-title">{car.plate}</div>
                        <div className="row-subtitle">
                          {car.model || "-"} · {car.color || "-"}
                        </div>
                      </div>
                      <div className="row-subtitle">
                        {clientsById[car.clientId]?.name || "Sem cliente"}
                      </div>
                    </div>
                  ))}
                  {filteredCars.length === 0 && (
                    <EmptyState text="Nenhum carro encontrado." />
                  )}
                </div>
              </Card>
            </div>
          </Section>
        )}

        {tab === "launches" && (
          <Section
            title="Lançamentos"
            subtitle="Informe a placa primeiro e confirme o serviço."
          >
            <div className="layout-grid">
              <Card>
                <form onSubmit={addLaunch} className="stack">
                  <Input
                    label="Data"
                    type="date"
                    value={launchForm.date}
                    onChange={(e) =>
                      setLaunchForm((p) => ({ ...p, date: e.target.value }))
                    }
                  />

                  <Input
                    label="Placa"
                    value={launchForm.plate}
                    onChange={(e) => handlePlateChange(e.target.value)}
                  />

                  <ReadOnlyField
                    label="Cliente identificado"
                    value={
                      clientsById[launchForm.clientId]?.name ||
                      "Não encontrado pela placa"
                    }
                  />

                  <Select
                    label="Serviço"
                    value={launchForm.serviceId}
                    onChange={(e) => handleLaunchService(e.target.value)}
                    options={[
                      { value: "", label: "Selecione" },
                      ...availableServicesForClient.map((s) => ({
                        value: s.id,
                        label: s.name,
                      })),
                    ]}
                  />

                  <Input
                    label="Valor"
                    type="number"
                    step="0.01"
                    value={launchForm.value}
                    onChange={(e) =>
                      setLaunchForm((p) => ({ ...p, value: e.target.value }))
                    }
                  />

                  <div className="field">
                    <label>Observações</label>
                    <textarea
                      rows={3}
                      value={launchForm.notes}
                      onChange={(e) =>
                        setLaunchForm((p) => ({ ...p, notes: e.target.value }))
                      }
                      className="textarea"
                    />
                  </div>

                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={launchForm.paid}
                      onChange={(e) =>
                        setLaunchForm((p) => ({ ...p, paid: e.target.checked }))
                      }
                    />
                    <span>Marcar como pago no lançamento</span>
                  </label>

                  <PrimaryButton>Salvar lançamento</PrimaryButton>
                </form>
              </Card>

              <Card>
                <div className="stack">
                  {data.launches.map((item) => (
                    <div className="client-card" key={item.id}>
                      <div className="client-top">
                        <div>
                          <div className="row-title">
                            {item.plate} · {servicesById[item.serviceId]?.name || "Serviço"}
                          </div>
                          <div className="row-subtitle">
                            {item.date} ·{" "}
                            {clientsById[item.clientId]?.name || "Sem cliente"} ·{" "}
                            {currency.format(item.value || 0)}
                          </div>
                          {item.notes && (
                            <div className="notes">{item.notes}</div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => togglePaid(item.id)}
                          className={`status-chip ${
                            item.paid ? "paid" : "open"
                          }`}
                        >
                          <CheckCircle2 size={15} />
                          {item.paid ? "Pago" : "Em aberto"}
                        </button>
                      </div>
                    </div>
                  ))}

                  {data.launches.length === 0 && (
                    <EmptyState text="Nenhum lançamento cadastrado ainda." />
                  )}
                </div>
              </Card>
            </div>
          </Section>
        )}

        {tab === "reports" && (
          <Section
            title="Relatórios"
            subtitle="Filtre os lançamentos e gere um PDF com resumo e detalhes."
          >
            <div className="report-grid">
              <Card>
                <div className="stack">
                  <Input
                    label="Data inicial"
                    type="date"
                    value={reportFilter.startDate}
                    onChange={(e) =>
                      setReportFilter((p) => ({
                        ...p,
                        startDate: e.target.value,
                      }))
                    }
                  />
                  <Input
                    label="Data final"
                    type="date"
                    value={reportFilter.endDate}
                    onChange={(e) =>
                      setReportFilter((p) => ({
                        ...p,
                        endDate: e.target.value,
                      }))
                    }
                  />
                  <Select
                    label="Cliente"
                    value={reportFilter.clientId}
                    onChange={(e) =>
                      setReportFilter((p) => ({
                        ...p,
                        clientId: e.target.value,
                      }))
                    }
                    options={[
                      { value: "", label: "Todos" },
                      ...data.clients.map((c) => ({ value: c.id, label: c.name })),
                    ]}
                  />
                  <Select
                    label="Pagamento"
                    value={reportFilter.paid}
                    onChange={(e) =>
                      setReportFilter((p) => ({ ...p, paid: e.target.value }))
                    }
                    options={[
                      { value: "all", label: "Todos" },
                      { value: "paid", label: "Somente pagos" },
                      { value: "open", label: "Somente em aberto" },
                    ]}
                  />
                  <PrimaryButton onClick={generateReportPdf} type="button">
                    <Download size={18} />
                    Gerar e compartilhar PDF
                  </PrimaryButton>
                </div>
              </Card>

              <div className="stack">
                <div className="stats-grid stats-report">
                  <StatCard title="Lançamentos" value={reportSummary.count} icon={<FileText size={18} />} />
                  <StatCard title="Total" value={currency.format(reportSummary.total)} icon={<DollarSign size={18} />} />
                  <StatCard title="Pago" value={currency.format(reportSummary.paid)} icon={<CheckCircle2 size={18} />} />
                  <StatCard title="Em aberto" value={currency.format(reportSummary.open)} icon={<CalendarDays size={18} />} />
                </div>

                <Card>
                  <div className="mobile-list">
                    {reportRows.map((item) => (
                      <div className="mobile-row" key={item.id}>
                        <div>
                          <div className="row-title">
                            {item.date} · {item.plate}
                          </div>
                          <div className="row-subtitle">
                            {clientsById[item.clientId]?.name || "-"} ·{" "}
                            {servicesById[item.serviceId]?.name || "-"}
                          </div>
                        </div>

                        <div className="right-block">
                          <div className="row-value">
                            {currency.format(item.value || 0)}
                          </div>
                          <span
                            className={`status-chip small ${item.paid ? "paid" : "open"}`}
                          >
                            {item.paid ? "Pago" : "Aberto"}
                          </span>
                        </div>
                      </div>
                    ))}

                    {reportRows.length === 0 && (
                      <EmptyState text="Nenhum resultado com os filtros escolhidos." />
                    )}
                  </div>
                </Card>
              </div>
            </div>
          </Section>
        )}
      </main>

      <nav className="bottom-nav">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = tab === item.key;

          return (
            <button
              key={item.key}
              type="button"
              className={`bottom-item ${active ? "active" : ""}`}
              onClick={() => setTab(item.key)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="section"
    >
      <div className="section-head">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {children}
    </motion.section>
  );
}

function Card({ children }) {
  return <div className="card">{children}</div>;
}

function StatCard({ title, value, icon }) {
  return (
    <div className="stat-card">
      <div className="stat-head">
        <span>{title}</span>
        <div className="stat-icon">{icon}</div>
      </div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input className="input" {...props} />
    </div>
  );
}

function Select({ label, options, ...props }) {
  return (
    <div className="field">
      <label>{label}</label>
      <select className="input" {...props}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function PrimaryButton({ children, onClick, type = "submit" }) {
  return (
    <button onClick={onClick} type={type} className="primary-btn">
      {children}
    </button>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="readonly">
        <Pencil size={16} />
        <span>{value}</span>
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return <div className="empty">{text}</div>;
}

const styles = `
:root{
  --bg:#f3f5f9;
  --card:#ffffff;
  --text:#0f172a;
  --muted:#64748b;
  --line:#e2e8f0;
  --primary:#0f172a;
  --primary-soft:#1e293b;
  --shadow:0 10px 24px rgba(15,23,42,.08);
  --radius:22px;
}
*{box-sizing:border-box}
html,body,#root{margin:0;min-height:100%}
body{
  font-family: Inter, Arial, sans-serif;
  background:linear-gradient(180deg,#eef2f7 0%, #f5f7fb 100%);
  color:var(--text);
}
button,input,select,textarea{font:inherit}
.hidden{display:none}

.app{
  min-height:100vh;
  padding-bottom:92px;
}

.topbar{
  position:sticky;
  top:0;
  z-index:20;
  backdrop-filter:blur(16px);
  background:rgba(245,247,251,.88);
  border-bottom:1px solid rgba(226,232,240,.85);
  padding:14px;
}

.topbar-card{
  background:linear-gradient(135deg,#0f172a 0%, #243042 100%);
  border-radius:28px;
  padding:18px;
  color:#fff;
  box-shadow:var(--shadow);
}

.brand{
  font-size:30px;
  font-weight:800;
  line-height:1.05;
  letter-spacing:-.02em;
}

.subtitle{
  margin-top:6px;
  color:rgba(255,255,255,.82);
  line-height:1.45;
  font-size:14px;
}

.save-badge{
  margin-top:14px;
  display:inline-flex;
  align-items:center;
  gap:8px;
  padding:10px 14px;
  border-radius:999px;
  background:rgba(255,255,255,.12);
  color:#e5eefb;
  font-size:12px;
  font-weight:700;
  max-width:100%;
  white-space:normal;
  line-height:1.35;
}

.top-actions{
  margin-top:12px;
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:12px;
}

.container{
  width:min(1100px,100%);
  margin:0 auto;
  padding:14px;
}

.section{
  display:flex;
  flex-direction:column;
  gap:14px;
  margin-bottom:18px;
}

.section-head h2{
  margin:0;
  font-size:22px;
  line-height:1.1;
}

.section-head p{
  margin:6px 0 0;
  color:var(--muted);
  line-height:1.5;
  font-size:14px;
}

.stats-grid{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:12px;
}

.stats-report{
  grid-template-columns:repeat(2,minmax(0,1fr));
}

.stat-card{
  background:var(--card);
  border:1px solid var(--line);
  border-radius:24px;
  padding:16px;
  box-shadow:var(--shadow);
  min-height:110px;
}

.stat-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
  color:var(--muted);
  font-size:13px;
  font-weight:700;
}

.stat-icon{
  width:34px;
  height:34px;
  border-radius:12px;
  display:grid;
  place-items:center;
  background:#f1f5f9;
  color:var(--primary);
  flex:0 0 auto;
}

.stat-value{
  margin-top:12px;
  font-size:20px;
  font-weight:800;
  line-height:1.15;
  word-break:break-word;
}

.card{
  background:var(--card);
  border:1px solid var(--line);
  border-radius:26px;
  padding:16px;
  box-shadow:var(--shadow);
}

.layout-grid,
.report-grid{
  display:grid;
  gap:14px;
}

.layout-grid.wide{
  display:grid;
  gap:14px;
}

.stack{
  display:flex;
  flex-direction:column;
  gap:14px;
}

.field label{
  display:block;
  margin-bottom:6px;
  font-size:13px;
  font-weight:700;
}

.input,
.textarea,
.readonly,
.search-input{
  width:100%;
  min-height:52px;
  border:1px solid var(--line);
  border-radius:18px;
  background:#fff;
  padding:12px 14px;
  color:var(--text);
  outline:none;
  font-size:16px;
}

.textarea{
  min-height:98px;
  resize:vertical;
}

.readonly{
  display:flex;
  align-items:center;
  gap:8px;
  background:#f8fafc;
}

.primary-btn,
.secondary-btn,
.chip-btn{
  border:none;
  border-radius:18px;
  min-height:52px;
  padding:12px 14px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  font-weight:800;
  cursor:pointer;
}

.primary-btn{
  width:100%;
  background:linear-gradient(135deg,#0b132f 0%, #0f172a 100%);
  color:#fff;
}

.secondary-btn{
  width:100%;
  background:#fff;
  border:1px solid var(--line);
  color:var(--text);
}

.action-grid{
  display:grid;
  gap:10px;
}

.edit-banner{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
  border:1px solid #fed7aa;
  background:#fff7ed;
  color:#9a3412;
  border-radius:18px;
  padding:12px 14px;
  font-size:13px;
  font-weight:700;
}

.section-mini-title{
  font-size:14px;
  font-weight:800;
}

.service-box{
  display:flex;
  flex-direction:column;
  gap:10px;
  border:1px solid var(--line);
  border-radius:20px;
  padding:12px;
  background:#f8fafc;
}

.service-item{
  border:1px solid var(--line);
  border-radius:18px;
  padding:12px;
  background:#fff;
}

.service-header{
  display:flex;
  flex-direction:column;
  gap:8px;
}

.check-row{
  display:flex;
  align-items:center;
  gap:10px;
  font-size:14px;
  font-weight:600;
}

.check-row input{
  width:18px;
  height:18px;
  flex:0 0 auto;
}

.muted-small{
  color:var(--muted);
  font-size:12px;
}

.search-wrap{
  display:flex;
  align-items:center;
  gap:10px;
  border:1px solid var(--line);
  border-radius:18px;
  padding:0 14px;
  min-height:52px;
  background:#fff;
  margin-bottom:12px;
}

.search-input{
  border:none;
  background:transparent;
  padding:0;
}

.mobile-list{
  display:flex;
  flex-direction:column;
  gap:10px;
}

.mobile-row{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
  padding:14px;
  border:1px solid var(--line);
  border-radius:18px;
  background:#fff;
}

.row-title{
  font-size:15px;
  font-weight:800;
  line-height:1.35;
}

.row-subtitle{
  margin-top:4px;
  color:var(--muted);
  font-size:13px;
  line-height:1.45;
}

.row-value{
  font-size:15px;
  font-weight:800;
  text-align:right;
}

.client-card{
  padding:14px;
  border:1px solid var(--line);
  border-radius:20px;
  background:#fff;
}

.client-top{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:10px;
}

.chips{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  margin-top:12px;
}

.chip{
  display:inline-flex;
  align-items:center;
  gap:6px;
  padding:8px 10px;
  border-radius:999px;
  background:#eef2ff;
  color:#1e293b;
  font-size:12px;
  font-weight:700;
}

.chip.dark{
  background:#0f172a;
  color:#fff;
}

.chip-btn{
  min-height:36px;
  padding:0 12px;
  border-radius:999px;
  background:#fff;
  border:1px solid var(--line);
  font-size:12px;
}

.notes{
  margin-top:8px;
  color:var(--muted);
  font-size:13px;
  line-height:1.45;
}

.status-chip{
  display:inline-flex;
  align-items:center;
  gap:6px;
  border:none;
  border-radius:999px;
  padding:9px 12px;
  font-size:12px;
  font-weight:800;
  white-space:nowrap;
}

.status-chip.paid{
  background:#dcfce7;
  color:#166534;
}

.status-chip.open{
  background:#fef3c7;
  color:#92400e;
}

.status-chip.small{
  padding:6px 10px;
  font-size:11px;
}

.right-block{
  display:flex;
  flex-direction:column;
  align-items:flex-end;
  gap:6px;
}

.empty,
.empty-inline{
  border:1px dashed #cbd5e1;
  border-radius:18px;
  padding:18px;
  text-align:center;
  color:var(--muted);
  background:#fff;
  line-height:1.45;
}

.bottom-nav{
  position:fixed;
  left:0;
  right:0;
  bottom:0;
  z-index:30;
  display:grid;
  grid-template-columns:repeat(6,1fr);
  gap:6px;
  padding:10px 10px calc(10px + env(safe-area-inset-bottom));
  background:rgba(255,255,255,.94);
  backdrop-filter:blur(14px);
  border-top:1px solid rgba(226,232,240,.9);
}

.bottom-item{
  border:none;
  background:transparent;
  border-radius:18px;
  min-height:64px;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:6px;
  color:var(--muted);
  font-size:11px;
  font-weight:800;
  padding:8px 4px;
}

.bottom-item.active{
  background:#0f172a;
  color:#fff;
}

@media (min-width: 768px){
  .topbar{
    padding:18px 18px 12px;
  }

  .top-actions{
    max-width:420px;
  }

  .layout-grid{
    grid-template-columns:380px 1fr;
  }

  .layout-grid.wide{
    grid-template-columns:430px 1fr;
  }

  .report-grid{
    grid-template-columns:320px 1fr;
  }

  .stats-grid{
    grid-template-columns:repeat(3,minmax(0,1fr));
  }

  .stats-report{
    grid-template-columns:repeat(4,minmax(0,1fr));
  }

  .action-grid{
    grid-template-columns:1fr 1fr;
  }
}

@media (min-width: 1024px){
  .container{
    padding:20px;
  }

  .stats-grid{
    grid-template-columns:repeat(6,minmax(0,1fr));
  }

  .bottom-nav{
    left:50%;
    transform:translateX(-50%);
    max-width:760px;
    bottom:14px;
    border:1px solid var(--line);
    border-radius:26px;
    box-shadow:var(--shadow);
  }
}
`;

export default App;
