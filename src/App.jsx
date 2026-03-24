import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Download,
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
  Upload,
  CalendarDays,
  DollarSign,
} from "lucide-react";
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

function fileNameSafeDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function App() {
  const fileInputRef = useRef(null);

  const [data, setData] = useState(initialData);
  const [tab, setTab] = useState("dashboard");
  const [searchPlate, setSearchPlate] = useState("");
  const [saveMessage, setSaveMessage] = useState("Dados salvos neste aparelho.");
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
    <div className="app-shell">
      <style>{`
        :root{
          --bg:#f3f5f8;
          --card:#ffffff;
          --text:#0f172a;
          --muted:#64748b;
          --line:#e2e8f0;
          --primary:#0f172a;
          --primary-2:#1e293b;
          --success:#047857;
          --success-bg:#d1fae5;
          --warning:#b45309;
          --warning-bg:#fef3c7;
          --soft:#f8fafc;
          --shadow:0 10px 30px rgba(15,23,42,.08);
          --radius:20px;
        }
        *{box-sizing:border-box}
        html,body,#root{margin:0;padding:0;min-height:100%}
        body{
          font-family: Inter, Arial, sans-serif;
          background:var(--bg);
          color:var(--text);
        }
        button,input,select,textarea{font:inherit}
        .app-shell{
          min-height:100vh;
          background:
            radial-gradient(circle at top, rgba(15,23,42,.06), transparent 25%),
            var(--bg);
          padding-bottom:92px;
        }
        .container{
          width:100%;
          max-width:1180px;
          margin:0 auto;
          padding:16px;
        }
        .topbar{
          display:flex;
          flex-direction:column;
          gap:14px;
          margin-bottom:16px;
        }
        .hero{
          background:linear-gradient(135deg, #0f172a, #1e293b);
          color:#fff;
          border-radius:28px;
          padding:18px;
          box-shadow:var(--shadow);
        }
        .hero h1{
          margin:0 0 6px;
          font-size:28px;
          line-height:1.1;
        }
        .hero p{
          margin:0;
          color:rgba(255,255,255,.82);
          line-height:1.45;
        }
        .save-chip{
          margin-top:14px;
          display:inline-flex;
          align-items:center;
          gap:8px;
          border-radius:999px;
          background:rgba(255,255,255,.12);
          padding:8px 12px;
          font-size:12px;
          color:#e2e8f0;
        }
        .quick-actions{
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
        }
        .ghost-btn,.ghost-file-btn,.primary-btn,.soft-btn{
          min-height:48px;
          border:none;
          border-radius:16px;
          padding:12px 14px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          gap:10px;
          font-weight:600;
          cursor:pointer;
          transition:.2s ease;
        }
        .ghost-btn,.ghost-file-btn{
          background:#fff;
          border:1px solid var(--line);
          color:var(--text);
          box-shadow:var(--shadow);
        }
        .primary-btn{
          background:var(--primary);
          color:#fff;
          width:100%;
        }
        .soft-btn{
          background:#fff;
          color:var(--text);
          border:1px solid var(--line);
          width:100%;
        }
        .ghost-btn:active,.ghost-file-btn:active,.primary-btn:active,.soft-btn:active{
          transform:scale(.98)
        }
        .hidden-input{display:none}
        .section{
          display:flex;
          flex-direction:column;
          gap:14px;
        }
        .section-head h2{
          margin:0 0 6px;
          font-size:22px;
        }
        .section-head p{
          margin:0;
          color:var(--muted);
          line-height:1.5;
        }
        .stats-grid{
          display:grid;
          grid-template-columns:repeat(2,1fr);
          gap:12px;
        }
        .stat-card,.card{
          background:var(--card);
          border:1px solid var(--line);
          border-radius:24px;
          box-shadow:var(--shadow);
        }
        .stat-card{
          padding:16px;
        }
        .stat-title{
          color:var(--muted);
          font-size:13px;
        }
        .stat-value{
          margin-top:8px;
          font-size:24px;
          font-weight:800;
          line-height:1.15;
          word-break:break-word;
        }
        .card{
          padding:16px;
        }
        .stack{
          display:flex;
          flex-direction:column;
          gap:14px;
        }
        .grid-2,.grid-main,.report-grid{
          display:grid;
          gap:14px;
        }
        .field label{
          display:block;
          margin-bottom:6px;
          font-size:13px;
          font-weight:700;
        }
        .input,.select,.textarea,.readonly{
          width:100%;
          min-height:48px;
          border-radius:16px;
          border:1px solid var(--line);
          background:#fff;
          padding:12px 14px;
          color:var(--text);
          outline:none;
        }
        .textarea{
          min-height:96px;
          resize:vertical;
        }
        .readonly{
          display:flex;
          align-items:center;
          gap:10px;
          background:var(--soft);
        }
        .search-box{
          display:flex;
          align-items:center;
          gap:10px;
          border:1px solid var(--line);
          border-radius:16px;
          padding:12px 14px;
          background:#fff;
        }
        .search-box input{
          border:none;
          outline:none;
          background:transparent;
          width:100%;
          font-size:16px;
        }
        .table-wrap{
          overflow:auto;
          border-radius:18px;
          border:1px solid var(--line);
        }
        table{
          width:100%;
          min-width:640px;
          border-collapse:collapse;
          background:#fff;
        }
        th,td{
          text-align:left;
          padding:12px 14px;
          border-bottom:1px solid var(--line);
          font-size:14px;
        }
        th{color:var(--muted); font-weight:700}
        tr:last-child td{border-bottom:none}
        .list{
          display:flex;
          flex-direction:column;
          gap:12px;
        }
        .list-card{
          border:1px solid var(--line);
          border-radius:20px;
          padding:14px;
          background:#fff;
        }
        .list-row{
          display:flex;
          flex-direction:column;
          gap:12px;
        }
        .list-title{
          font-weight:800;
          line-height:1.35;
        }
        .list-subtitle,.muted{
          color:var(--muted);
          line-height:1.45;
        }
        .chip-row{
          display:flex;
          flex-wrap:wrap;
          gap:8px;
        }
        .chip{
          display:inline-flex;
          align-items:center;
          gap:6px;
          padding:7px 10px;
          border-radius:999px;
          font-size:12px;
          font-weight:700;
          background:#eef2ff;
          color:#1e293b;
        }
        .chip-dark{
          background:var(--primary);
          color:#fff;
        }
        .status-btn,.status-chip{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          gap:8px;
          border-radius:999px;
          padding:10px 14px;
          font-size:13px;
          font-weight:700;
          border:none;
        }
        .status-paid{
          background:var(--success-bg);
          color:var(--success);
        }
        .status-open{
          background:var(--warning-bg);
          color:var(--warning);
        }
        .banner-edit{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          border-radius:18px;
          padding:12px 14px;
          background:#fff7ed;
          color:#9a3412;
          border:1px solid #fed7aa;
          font-size:14px;
        }
        .checkbox-row{
          display:flex;
          align-items:center;
          gap:10px;
          font-size:14px;
          font-weight:600;
        }
        .services-client-list{
          display:flex;
          flex-direction:column;
          gap:10px;
          border:1px solid var(--line);
          border-radius:20px;
          padding:12px;
          background:var(--soft);
        }
        .service-price-card{
          background:#fff;
          border:1px solid var(--line);
          border-radius:18px;
          padding:12px;
        }
        .service-price-head{
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:12px;
          margin-bottom:8px;
        }
        .toolbar-mobile-note{
          font-size:12px;
          color:var(--muted);
        }
        .nav-desktop{
          display:none;
        }
        .bottom-nav{
          position:fixed;
          left:0;
          right:0;
          bottom:0;
          z-index:50;
          padding:10px 12px calc(10px + env(safe-area-inset-bottom));
          background:rgba(243,245,248,.92);
          backdrop-filter:blur(14px);
          border-top:1px solid rgba(148,163,184,.25);
        }
        .bottom-nav-inner{
          max-width:1180px;
          margin:0 auto;
          background:#fff;
          border:1px solid var(--line);
          border-radius:22px;
          box-shadow:var(--shadow);
          display:grid;
          grid-template-columns:repeat(6,1fr);
          gap:4px;
          padding:6px;
        }
        .nav-item{
          border:none;
          background:transparent;
          border-radius:16px;
          min-height:62px;
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          gap:6px;
          color:var(--muted);
          font-size:11px;
          font-weight:700;
          cursor:pointer;
          padding:8px 4px;
        }
        .nav-item.active{
          background:var(--primary);
          color:#fff;
        }
        .two-actions{
          display:grid;
          gap:10px;
        }
        .empty{
          border:1px dashed #cbd5e1;
          border-radius:18px;
          padding:18px;
          text-align:center;
          color:var(--muted);
          background:#fff;
        }
        .header-actions{
          display:flex;
          flex-direction:column;
          gap:10px;
        }
        @media (min-width: 768px){
          .container{padding:22px}
          .hero{padding:24px}
          .quick-actions{
            grid-template-columns:repeat(3, max-content);
            justify-content:flex-start;
          }
          .stats-grid{
            grid-template-columns:repeat(3,1fr);
          }
          .grid-main{
            grid-template-columns:420px 1fr;
          }
          .grid-2{
            grid-template-columns:460px 1fr;
          }
          .report-grid{
            grid-template-columns:320px 1fr;
          }
          .list-row{
            flex-direction:row;
            align-items:center;
            justify-content:space-between;
          }
          .two-actions{
            grid-template-columns:1fr 1fr;
          }
        }
        @media (min-width: 1024px){
          .nav-desktop{
            display:grid;
            grid-template-columns:repeat(6,1fr);
            gap:10px;
            margin-bottom:18px;
          }
          .nav-desktop .nav-item{
            background:#fff;
            border:1px solid var(--line);
            color:var(--text);
            box-shadow:var(--shadow);
            min-height:78px;
            flex-direction:row;
            justify-content:flex-start;
            padding:14px 16px;
            gap:10px;
            font-size:14px;
          }
          .nav-desktop .nav-item.active{
            background:var(--primary);
            color:#fff;
            border-color:var(--primary);
          }
          .bottom-nav{display:none}
          .stats-grid{
            grid-template-columns:repeat(6,1fr);
          }
        }
      `}</style>

      <div className="container">
        <div className="topbar">
          <div className="hero">
            <h1>JP BR Auto</h1>
            <p>Cadastro de clientes, carros, serviços, lançamentos e relatórios.</p>
            <div className="save-chip">
              <CheckCircle2 size={14} />
              {saveMessage}
            </div>
          </div>

          <div className="quick-actions">
            <button type="button" className="ghost-btn" onClick={exportBackup}>
              <Download size={18} />
              Backup
            </button>

            <button
              type="button"
              className="ghost-file-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={18} />
              Importar backup
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden-input"
              onChange={importBackup}
            />
          </div>
        </div>

        <div className="nav-desktop">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                className={`nav-item ${active ? "active" : ""}`}
                onClick={() => setTab(item.key)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {tab === "dashboard" && (
          <Section title="Visão geral" subtitle="Resumo rápido do dia e do financeiro.">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="stats-grid"
            >
              <StatCard title="Clientes" value={dashboardStats.clients} />
              <StatCard title="Carros" value={dashboardStats.cars} />
              <StatCard title="Serviços" value={dashboardStats.services} />
              <StatCard title="Hoje" value={currency.format(dashboardStats.today)} />
              <StatCard title="Pago" value={currency.format(dashboardStats.totalPaid)} />
              <StatCard title="Em aberto" value={currency.format(dashboardStats.totalOpen)} />
            </motion.div>
          </Section>
        )}

        {tab === "services" && (
          <Section
            title="Serviços"
            subtitle="Cadastre os serviços prestados e seus valores padrão."
          >
            <div className="grid-main">
              <Card>
                <form className="stack" onSubmit={addService}>
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
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Serviço</th>
                        <th>Valor padrão</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.services.map((service) => (
                        <tr key={service.id}>
                          <td>{service.name}</td>
                          <td>{currency.format(service.defaultPrice || 0)}</td>
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
          <Section
            title="Clientes"
            subtitle="Vincule valores personalizados por serviço para cada cliente."
          >
            <div className="grid-2">
              <Card>
                <form className="stack" onSubmit={addClient}>
                  {clientForm.id && (
                    <div className="banner-edit">
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
                    <div style={{ fontWeight: 800, fontSize: 14 }}>
                      Serviços vinculados ao cliente
                    </div>

                    <div className="services-client-list">
                      {data.services.length === 0 && (
                        <div className="muted">Cadastre serviços primeiro.</div>
                      )}

                      {data.services.map((service) => {
                        const selected = clientForm.pricing.find(
                          (p) => p.serviceId === service.id
                        );

                        return (
                          <div key={service.id} className="service-price-card">
                            <div className="service-price-head">
                              <label className="checkbox-row">
                                <input
                                  type="checkbox"
                                  checked={Boolean(selected)}
                                  onChange={() => toggleClientPricing(service.id)}
                                />
                                {service.name}
                              </label>
                              <span className="muted" style={{ fontSize: 12 }}>
                                Padrão: {currency.format(service.defaultPrice || 0)}
                              </span>
                            </div>

                            {selected && (
                              <Input
                                label="Valor para este cliente"
                                type="number"
                                step="0.01"
                                value={selected.price}
                                onChange={(e) =>
                                  updateClientPrice(service.id, e.target.value)
                                }
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="two-actions">
                    <PrimaryButton>
                      {clientForm.id ? "Atualizar cliente" : "Salvar cliente"}
                    </PrimaryButton>

                    {clientForm.id && (
                      <button
                        type="button"
                        className="soft-btn"
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
                <div className="list">
                  {data.clients.map((client) => (
                    <div key={client.id} className="list-card">
                      <div className="list-row">
                        <div>
                          <div className="list-title">{client.name}</div>
                          <div className="list-subtitle">
                            {client.phone || "Sem telefone"}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="soft-btn"
                          style={{ width: "auto" }}
                          onClick={() => editClient(client)}
                        >
                          <Pencil size={16} />
                          Editar
                        </button>
                      </div>

                      <div className="chip-row" style={{ marginTop: 12 }}>
                        {(client.pricing || []).map((pricing) => (
                          <span key={pricing.serviceId} className="chip chip-dark">
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
          <Section
            title="Carros"
            subtitle="Cadastre veículos e vincule cada placa ao cliente correto."
          >
            <div className="grid-main">
              <Card>
                <form className="stack" onSubmit={addCar}>
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
                <div className="stack">
                  <div className="search-box">
                    <Search size={18} />
                    <input
                      value={searchPlate}
                      onChange={(e) => setSearchPlate(e.target.value)}
                      placeholder="Buscar por placa"
                    />
                  </div>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Placa</th>
                          <th>Modelo</th>
                          <th>Cor</th>
                          <th>Cliente</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCars.map((car) => (
                          <tr key={car.id}>
                            <td>{car.plate}</td>
                            <td>{car.model || "-"}</td>
                            <td>{car.color || "-"}</td>
                            <td>{clientsById[car.clientId]?.name || "Sem cliente"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            </div>
          </Section>
        )}

        {tab === "launches" && (
          <Section
            title="Lançamentos"
            subtitle="Informe a placa, selecione o serviço e ajuste o valor se necessário."
          >
            <div className="grid-main">
              <Card>
                <form className="stack" onSubmit={addLaunch}>
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
                      className="textarea"
                      value={launchForm.notes}
                      onChange={(e) =>
                        setLaunchForm((p) => ({ ...p, notes: e.target.value }))
                      }
                      rows={3}
                    />
                  </div>

                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={launchForm.paid}
                      onChange={(e) =>
                        setLaunchForm((p) => ({ ...p, paid: e.target.checked }))
                      }
                    />
                    Marcar como pago no lançamento
                  </label>

                  <PrimaryButton>Salvar lançamento</PrimaryButton>
                </form>
              </Card>

              <Card>
                <div className="stack">
                  <div>
                    <div className="list-title">Últimos lançamentos</div>
                    <div className="list-subtitle">
                      Toque no status para marcar como pago ou em aberto.
                    </div>
                  </div>

                  <div className="list">
                    {data.launches.map((item) => (
                      <div key={item.id} className="list-card">
                        <div className="list-row">
                          <div>
                            <div className="list-title">
                              {item.plate} ·{" "}
                              {servicesById[item.serviceId]?.name || "Serviço"}
                            </div>
                            <div className="list-subtitle">
                              {item.date} ·{" "}
                              {clientsById[item.clientId]?.name || "Sem cliente"} ·{" "}
                              {currency.format(item.value || 0)}
                            </div>
                            {item.notes && (
                              <div className="muted" style={{ marginTop: 6 }}>
                                {item.notes}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => togglePaid(item.id)}
                            className={`status-btn ${
                              item.paid ? "status-paid" : "status-open"
                            }`}
                          >
                            <CheckCircle2 size={16} />
                            {item.paid ? "Pago" : "Em aberto"}
                          </button>
                        </div>
                      </div>
                    ))}

                    {data.launches.length === 0 && (
                      <div className="empty">Nenhum lançamento cadastrado ainda.</div>
                    )}
                  </div>
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
                <div className="stats-grid" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
                  <StatCard title="Lançamentos" value={reportSummary.count} />
                  <StatCard title="Total" value={currency.format(reportSummary.total)} />
                  <StatCard title="Pago" value={currency.format(reportSummary.paid)} />
                  <StatCard title="Em aberto" value={currency.format(reportSummary.open)} />
                </div>

                <Card>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Cliente</th>
                          <th>Telefone</th>
                          <th>Placa</th>
                          <th>Serviço</th>
                          <th>Valor</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportRows.map((item) => (
                          <tr key={item.id}>
                            <td>{item.date}</td>
                            <td>{clientsById[item.clientId]?.name || "-"}</td>
                            <td>{clientsById[item.clientId]?.phone || "-"}</td>
                            <td>{item.plate}</td>
                            <td>{servicesById[item.serviceId]?.name || "-"}</td>
                            <td>{currency.format(item.value || 0)}</td>
                            <td>
                              <span
                                className={`status-chip ${
                                  item.paid ? "status-paid" : "status-open"
                                }`}
                              >
                                {item.paid ? "Pago" : "Em aberto"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {reportRows.length === 0 && (
                      <div className="empty">Nenhum resultado com os filtros escolhidos.</div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          </Section>
        )}
      </div>

      <div className="bottom-nav">
        <div className="bottom-nav-inner">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.key;

            return (
              <button
                key={item.key}
                type="button"
                className={`nav-item ${active ? "active" : ""}`}
                onClick={() => setTab(item.key)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="section"
    >
      <div className="section-head">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {children}
    </motion.div>
  );
}

function Card({ children }) {
  return <div className="card">{children}</div>;
}

function StatCard({ title, value }) {
  return (
    <div className="stat-card">
      <div className="stat-title">{title}</div>
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
      <select className="select" {...props}>
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
