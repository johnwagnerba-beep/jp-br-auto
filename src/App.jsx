import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Download, Plus, Search, Car, Users, Wrench, FileText, CheckCircle2, Pencil, Save, X } from "lucide-react";
import jsPDF from "jspdf";

const STORAGE_KEY = "jpbr-auto-app-v1";

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

function formatCurrencyNumber(value) {
  return Number(value || 0).toFixed(2);
}

function fileNameSafeDate() {
  return new Date().toISOString().slice(0, 10);
}

function App() {
  const fileInputRef = useRef(null);
  const [data, setData] = useState(initialData);
  const [tab, setTab] = useState("dashboard");
  const [searchPlate, setSearchPlate] = useState("");
  const [reportFilter, setReportFilter] = useState({
    startDate: todayISO(),
    endDate: todayISO(),
    clientId: "",
    paid: "all",
  });

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
  const [saveMessage, setSaveMessage] = useState("Dados salvos neste aparelho.");

  useEffect(() => {
    setData(loadData());
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setSaveMessage(`Dados salvos neste aparelho em ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`);
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
    const plate = searchPlate.trim().toUpperCase();
    if (!plate) return data.cars;
    return data.cars.filter((c) => c.plate.toUpperCase().includes(plate));
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
        return { ...prev, pricing: prev.pricing.filter((p) => p.serviceId !== serviceId) };
      }
      const service = data.services.find((s) => s.id === serviceId);
      return {
        ...prev,
        pricing: [
          ...prev.pricing,
          { serviceId, price: service?.defaultPrice ?? 0 },
        ],
      };
    });
  }

  function updateClientPrice(serviceId, price) {
    setClientForm((prev) => ({
      ...prev,
      pricing: prev.pricing.map((p) => (p.serviceId === serviceId ? { ...p, price } : p)),
    }));
  }

  function editClient(client) {
    setClientForm({
      id: client.id,
      name: client.name || "",
      phone: client.phone || "",
      pricing: (client.pricing || []).map((p) => ({ ...p, price: Number(p.price || 0) })),
    });
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
      pricing: clientForm.pricing.map((p) => ({ ...p, price: Number(p.price || 0) })),
    };

    setData((prev) => {
      if (clientForm.id) {
        return {
          ...prev,
          clients: prev.clients.map((client) => (client.id === clientForm.id ? payload : client)),
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
    const clientId = car?.clientId || "";
    setLaunchForm((prev) => ({
      ...prev,
      plate: normalized,
      carId: car?.id || "",
      clientId,
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
      (c) => c.id === launchForm.carId || c.plate.toUpperCase() === launchForm.plate.toUpperCase()
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
    const paid = reportRows.filter((r) => r.paid).reduce((sum, item) => sum + Number(item.value || 0), 0);
    const open = reportRows.filter((r) => !r.paid).reduce((sum, item) => sum + Number(item.value || 0), 0);
    return { total, paid, open, count: reportRows.length };
  }, [reportRows]);

  function buildReportPdf() {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    let y = 48;

    const periodText = `${reportFilter.startDate || "início"} até ${reportFilter.endDate || "fim"}`;

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
    drawBox(margin + boxWidth + gap, y, boxWidth, 58, "Total", currency.format(reportSummary.total));
    y += 70;
    drawBox(margin, y, boxWidth, 58, "Pago", currency.format(reportSummary.paid));
    drawBox(margin + boxWidth + gap, y, boxWidth, 58, "Em aberto", currency.format(reportSummary.open));
    y += 84;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Detalhes dos serviços", margin, y);
    y += 18;

    if (reportRows.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text("Nenhum lançamento encontrado com os filtros selecionados.", margin, y);
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
          `Valor: ${currency.format(item.value)} · Status: ${item.paid ? "Pago" : "Em aberto"}`,
          `Observações: ${notes}`,
        ];

        const wrapped = lines.flatMap((line) => doc.splitTextToSize(line, pageWidth - margin * 2 - 16));
        const blockHeight = wrapped.length * 14 + 18;
        ensureSpace(blockHeight + 10);

        doc.setDrawColor(220, 226, 232);
        doc.roundedRect(margin, y - 2, pageWidth - margin * 2, blockHeight, 10, 10);
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
      const pdfFile = new File([pdfBlob], fileName, { type: "application/pdf" });

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

  function exportBackup() {
    const backup = {
      exportedAt: new Date().toISOString(),
      app: "JP BR Auto",
      version: 1,
      data,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
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

const availableServicesForClient = useMemo(() => {
  const client = data.clients.find((c) => c.id === launchForm.clientId);
  if (!client) return data.services;
  if (!client.pricing?.length) return data.services;
  return client.pricing
    .map((p) => data.services.find((s) => s.id === p.serviceId))
    .filter(Boolean);
}, [data.clients, data.services, launchForm.clientId]);

const tabs = [
  { key: "dashboard", label: "Dashboard", icon: FileText },
  { key: "services", label: "Serviços", icon: Wrench },
  { key: "clients", label: "Clientes", icon: Users },
  { key: "cars", label: "Carros", icon: Car },
  { key: "launches", label: "Lançamentos", icon: Plus },
  { key: "reports", label: "Relatórios", icon: Download },
];

return (
  <div className="min-h-screen bg-slate-50 text-slate-900">
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">JP BR Auto</h1>
          <p className="text-sm text-slate-600">Cadastro de clientes, carros, serviços, lançamentos e relatórios.</p>
        </div>
        <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
          <div className="text-xs uppercase tracking-wide text-slate-500">Sistema web</div>
          <div className="mt-1 font-semibold">Pronto para lançamentos, acompanhamento e geração de PDF</div>
          <div className="mt-2 text-xs text-emerald-700">{saveMessage}</div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={exportBackup}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
        >
          <Download className="h-4 w-4" /> Backup dos dados
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
        >
          <Plus className="h-4 w-4" /> Importar backup
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={importBackup} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-6">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`rounded-2xl border px-4 py-3 text-left shadow-sm transition ${
                active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <Icon className="mb-2 h-5 w-5" />
              <div className="text-sm font-semibold">{item.label}</div>
            </button>
          );
        })}
      </div>

      {tab === "dashboard" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <StatCard title="Clientes" value={dashboardStats.clients} />
          <StatCard title="Carros" value={dashboardStats.cars} />
          <StatCard title="Serviços" value={dashboardStats.services} />
          <StatCard title="Hoje" value={currency.format(dashboardStats.today)} />
          <StatCard title="Pago" value={currency.format(dashboardStats.totalPaid)} />
          <StatCard title="Em aberto" value={currency.format(dashboardStats.totalOpen)} />
        </motion.div>
      )}

      {tab === "services" && (
        <Section title="Cadastro de serviços" subtitle="Cadastre os serviços prestados e o valor padrão.">
          <div className="grid gap-6 lg:grid-cols-[420px,1fr]">
            <Card>
              <form onSubmit={addService} className="space-y-4">
                <Input label="Nome do serviço" value={serviceForm.name} onChange={(e) => setServiceForm((p) => ({ ...p, name: e.target.value }))} />
                <Input label="Valor padrão" type="number" step="0.01" value={serviceForm.defaultPrice} onChange={(e) => setServiceForm((p) => ({ ...p, defaultPrice: e.target.value }))} />
                <PrimaryButton>Salvar serviço</PrimaryButton>
              </form>
            </Card>
            <Card>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-slate-500">
                      <th className="py-3">Serviço</th>
                      <th className="py-3">Valor padrão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.services.map((service) => (
                      <tr key={service.id} className="border-b last:border-0">
                        <td className="py-3 font-medium">{service.name}</td>
                        <td className="py-3">{currency.format(service.defaultPrice || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </Section>
      )}

      {tab === "clients" && (
        <Section title="Cadastro de clientes" subtitle="Inclua nome, telefone e os serviços com preço personalizado para cada cliente. Você pode editar o cliente depois e alterar os valores por serviço.">
          <div className="grid gap-6 lg:grid-cols-[460px,1fr]">
            <Card>
              <form onSubmit={addClient} className="space-y-4">
                {clientForm.id && (
                  <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <span>Editando cliente e valores personalizados por serviço.</span>
                    <Save className="h-4 w-4" />
                  </div>
                )}
                <Input label="Nome do cliente" value={clientForm.name} onChange={(e) => setClientForm((p) => ({ ...p, name: e.target.value }))} />
                <Input label="Telefone" value={clientForm.phone} onChange={(e) => setClientForm((p) => ({ ...p, phone: e.target.value }))} />

                <div>
                  <div className="mb-2 text-sm font-semibold">Serviços vinculados ao cliente</div>
                  <div className="space-y-2 rounded-2xl border border-slate-200 p-3">
                    {data.services.length === 0 && <p className="text-sm text-slate-500">Cadastre serviços primeiro.</p>}
                    {data.services.map((service) => {
                      const selected = clientForm.pricing.find((p) => p.serviceId === service.id);
                      return (
                        <div key={service.id} className="rounded-xl border border-slate-200 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <label className="flex items-center gap-2 text-sm font-medium">
                              <input type="checkbox" checked={Boolean(selected)} onChange={() => toggleClientPricing(service.id)} />
                              {service.name}
                            </label>
                            <span className="text-xs text-slate-500">Padrão: {currency.format(service.defaultPrice || 0)}</span>
                          </div>
                          {selected && (
                            <div className="mt-3">
                              <Input
                                label="Valor para este cliente"
                                type="number"
                                step="0.01"
                                value={selected.price}
                                onChange={(e) => updateClientPrice(service.id, e.target.value)}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <PrimaryButton>{clientForm.id ? "Atualizar cliente" : "Salvar cliente"}</PrimaryButton>
                  {clientForm.id && (
                    <button
                      type="button"
                      onClick={resetClientForm}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                    >
                      <X className="h-4 w-4" /> Cancelar edição
                    </button>
                  )}
                </div>
              </form>
            </Card>
            <Card>
              <div className="space-y-3">
                {data.clients.map((client) => (
                  <div key={client.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold">{client.name}</div>
                        <div className="text-sm text-slate-600">{client.phone || "Sem telefone"}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">{client.pricing?.length || 0} serviço(s)</div>
                        <button
                          type="button"
                          onClick={() => editClient(client)}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(client.pricing || []).map((pricing) => (
                        <span key={pricing.serviceId} className="rounded-full bg-slate-900 px-3 py-1 text-xs text-white">
                          {servicesById[pricing.serviceId]?.name} · {currency.format(pricing.price || 0)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </Section>
      )}

      {tab === "cars" && (
        <Section title="Cadastro de carros" subtitle="Cadastre a placa e vincule o carro ao cliente.">
          <div className="grid gap-6 lg:grid-cols-[420px,1fr]">
            <Card>
              <form onSubmit={addCar} className="space-y-4">
                <Input label="Placa" value={carForm.plate} onChange={(e) => setCarForm((p) => ({ ...p, plate: e.target.value.toUpperCase() }))} />
                <Input label="Modelo" value={carForm.model} onChange={(e) => setCarForm((p) => ({ ...p, model: e.target.value }))} />
                <Input label="Cor" value={carForm.color} onChange={(e) => setCarForm((p) => ({ ...p, color: e.target.value }))} />
                <Select
                  label="Cliente"
                  value={carForm.clientId}
                  onChange={(e) => setCarForm((p) => ({ ...p, clientId: e.target.value }))}
                  options={[{ value: "", label: "Selecione" }, ...data.clients.map((c) => ({ value: c.id, label: c.name }))]}
                />
                <PrimaryButton>Salvar carro</PrimaryButton>
              </form>
            </Card>
            <Card>
              <div className="mb-4 flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2">
                <Search className="h-4 w-4 text-slate-500" />
                <input
                  value={searchPlate}
                  onChange={(e) => setSearchPlate(e.target.value)}
                  placeholder="Buscar por placa"
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-slate-500">
                      <th className="py-3">Placa</th>
                      <th className="py-3">Modelo</th>
                      <th className="py-3">Cor</th>
                      <th className="py-3">Cliente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCars.map((car) => (
                      <tr key={car.id} className="border-b last:border-0">
                        <td className="py-3 font-semibold">{car.plate}</td>
                        <td className="py-3">{car.model || "-"}</td>
                        <td className="py-3">{car.color || "-"}</td>
                        <td className="py-3">{clientsById[car.clientId]?.name || "Sem cliente"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </Section>
      )}

      {tab === "launches" && (
        <Section title="Lançamento de serviços" subtitle="Informe a placa primeiro. O sistema busca o cliente e sugere o valor cadastrado, com edição livre.">
          <div className="grid gap-6 lg:grid-cols-[420px,1fr]">
            <Card>
              <form onSubmit={addLaunch} className="space-y-4">
                <Input label="Data" type="date" value={launchForm.date} onChange={(e) => setLaunchForm((p) => ({ ...p, date: e.target.value }))} />
                <Input label="Placa" value={launchForm.plate} onChange={(e) => handlePlateChange(e.target.value)} />
                <ReadOnlyField label="Cliente identificado" value={clientsById[launchForm.clientId]?.name || "Não encontrado pela placa"} />
                <Select
                  label="Serviço"
                  value={launchForm.serviceId}
                  onChange={(e) => handleLaunchService(e.target.value)}
                  options={[
                    { value: "", label: "Selecione" },
                    ...availableServicesForClient.map((s) => ({ value: s.id, label: s.name })),
                  ]}
                />
                <Input
                  label="Valor"
                  type="number"
                  step="0.01"
                  value={launchForm.value}
                  onChange={(e) => setLaunchForm((p) => ({ ...p, value: e.target.value }))}
                />
                <div>
                  <label className="mb-1 block text-sm font-medium">Observações</label>
                  <textarea
                    value={launchForm.notes}
                    onChange={(e) => setLaunchForm((p) => ({ ...p, notes: e.target.value }))}
                    rows={3}
                    className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={launchForm.paid}
                    onChange={(e) => setLaunchForm((p) => ({ ...p, paid: e.target.checked }))}
                  />
                  Marcar como pago no lançamento
                </label>
                <PrimaryButton>Salvar lançamento</PrimaryButton>
              </form>
            </Card>

            <Card>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold">Últimos lançamentos</div>
                  <div className="text-sm text-slate-500">Clique no status para marcar ou desmarcar como pago.</div>
                </div>
              </div>
              <div className="space-y-3">
                {data.launches.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-semibold">{item.plate} · {servicesById[item.serviceId]?.name || "Serviço"}</div>
                        <div className="text-sm text-slate-600">
                          {item.date} · {clientsById[item.clientId]?.name || "Sem cliente"} · {currency.format(item.value || 0)}
                        </div>
                        {item.notes && <div className="mt-1 text-sm text-slate-500">{item.notes}</div>}
                      </div>
                      <button
                        type="button"
                        onClick={() => togglePaid(item.id)}
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                          item.paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {item.paid ? "Pago" : "Em aberto"}
                      </button>
                    </div>
                  </div>
                ))}
                {data.launches.length === 0 && <EmptyState text="Nenhum lançamento cadastrado ainda." />}
              </div>
            </Card>
          </div>
        </Section>
      )}

      {tab === "reports" && (
        <Section title="Relatórios" subtitle="Filtre por período, cliente e status. Gere um PDF com dashboard e detalhes dos serviços para encaminhar a qualquer contato.">
          <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
            <Card>
              <div className="space-y-4">
                <Input label="Data inicial" type="date" value={reportFilter.startDate} onChange={(e) => setReportFilter((p) => ({ ...p, startDate: e.target.value }))} />
                <Input label="Data final" type="date" value={reportFilter.endDate} onChange={(e) => setReportFilter((p) => ({ ...p, endDate: e.target.value }))} />
                <Select
                  label="Cliente"
                  value={reportFilter.clientId}
                  onChange={(e) => setReportFilter((p) => ({ ...p, clientId: e.target.value }))}
                  options={[{ value: "", label: "Todos" }, ...data.clients.map((c) => ({ value: c.id, label: c.name }))]}
                />
                <Select
                  label="Pagamento"
                  value={reportFilter.paid}
                  onChange={(e) => setReportFilter((p) => ({ ...p, paid: e.target.value }))}
                  options={[
                    { value: "all", label: "Todos" },
                    { value: "paid", label: "Somente pagos" },
                    { value: "open", label: "Somente em aberto" },
                  ]}
                />
                <div className="grid gap-3">
                  <PrimaryButton onClick={generateReportPdf} type="button">
                    <Download className="h-4 w-4" /> Gerar e compartilhar PDF
                  </PrimaryButton>
                </div>
              </div>
            </Card>

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <StatCard title="Lançamentos" value={reportSummary.count} />
                <StatCard title="Total" value={currency.format(reportSummary.total)} />
                <StatCard title="Pago" value={currency.format(reportSummary.paid)} />
                <StatCard title="Em aberto" value={currency.format(reportSummary.open)} />
              </div>
              <Card>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-slate-500">
                        <th className="py-3">Data</th>
                        <th className="py-3">Cliente</th>
                        <th className="py-3">Telefone</th>
                        <th className="py-3">Placa</th>
                        <th className="py-3">Serviço</th>
                        <th className="py-3">Valor</th>
                        <th className="py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportRows.map((item) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="py-3">{item.date}</td>
                          <td className="py-3">{clientsById[item.clientId]?.name || "-"}</td>
                          <td className="py-3">{clientsById[item.clientId]?.phone || "-"}</td>
                          <td className="py-3 font-semibold">{item.plate}</td>
                          <td className="py-3">{servicesById[item.serviceId]?.name || "-"}</td>
                          <td className="py-3">{currency.format(item.value || 0)}</td>
                          <td className="py-3">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                              {item.paid ? "Pago" : "Em aberto"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {reportRows.length === 0 && <EmptyState text="Nenhum resultado com os filtros escolhidos." />}
                </div>
              </Card>
            </div>
          </div>
        </Section>
      )}
    </div>
  </div>
);
}

function Section({ title, subtitle, children }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">{title}</h2>
        <p className="text-sm text-slate-600">{subtitle}</p>
      </div>
      {children}
    </motion.div>
  );
}

function Card({ children }) {
  return <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">{children}</div>;
}

function StatCard({ title, value }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input {...props} className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400" />
    </div>
  );
}

function Select({ label, options, ...props }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <select {...props} className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400">
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
    <button onClick={onClick} type={type} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white active:scale-[0.99]">
      {children}
    </button>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        <Pencil className="h-4 w-4 text-slate-400" />
        {value}
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{text}</div>;
}

export default App;
