import { useState, useEffect, useMemo } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { type Lifeguard } from "../types/Lifeguard";
import { type BeachPost } from "../types/BeachPost";
import {
  generateSchedule,
  type FinalSchedule,
  type AssignedCompulsoryDaysOff,
  type ReasoningLog,
} from "../utils/scheduleAlgorithm";
import React from "react";
import type { SavedSchedule } from "../types/SavedSchedule";
import LogViewerModal from "../components/modals/LogViewModal";
import * as Button from "../components/ui/Button";
import {
  FaArrowLeft,
  FaArrowRight,
  FaBroom,
  FaCheck,
  FaFloppyDisk,
  FaList,
  FaPlay,
} from "react-icons/fa6";

type CapacityMatrix = { [postId: string]: { [date: string]: number } };
type RequestedDaysOff = { [lifeguardId: string]: { [date: string]: boolean } };

type ScheduleGeneratorState = {
  startDate: string;
  endDate: string;
  g1Shifts: number;
  g2Shifts: number;
  capacityMatrix: CapacityMatrix;
  requestedDaysOff: RequestedDaysOff;
  finalSchedule: FinalSchedule | null;
  assignedFCs: AssignedCompulsoryDaysOff | null;
  reasoningLog: ReasoningLog | null;
};

export default function ScheduleGeneratorPage() {
  const [lifeguards] = useLocalStorage<Lifeguard[]>("bac-roster", []);
  const [posts] = useLocalStorage<BeachPost[]>("bac-posts", []);
  const [scheduleHistory, setScheduleHistory] = useLocalStorage<
    SavedSchedule[]
  >("bac-schedule-history", []);

  const [savedState, setSavedState] =
    useLocalStorage<ScheduleGeneratorState | null>(
      "bac-schedule-generator-state",
      null
    );

  const [startDate, setStartDate] = useState(savedState?.startDate || "");
  const [endDate, setEndDate] = useState(savedState?.endDate || "");
  const [g1Shifts, setG1Shifts] = useState(savedState?.g1Shifts || 11);
  const [g2Shifts, setG2Shifts] = useState(savedState?.g2Shifts || 10);
  const [days, setDays] = useState<string[]>([]);
  const [capacityMatrix, setCapacityMatrix] = useState<CapacityMatrix>(
    savedState?.capacityMatrix || {}
  );
  const [requestedDaysOff, setRequestedDaysOff] = useState<RequestedDaysOff>(
    savedState?.requestedDaysOff || {}
  );
  const [finalSchedule, setFinalSchedule] = useState<FinalSchedule | null>(
    savedState?.finalSchedule || null
  );
  const [assignedFCs, setAssignedFCs] =
    useState<AssignedCompulsoryDaysOff | null>(savedState?.assignedFCs || null);

  const [reasoningLog, setReasoningLog] = useState<ReasoningLog | null>(
    savedState?.reasoningLog || null
  );

  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  const [currentStep, setCurrentStepRaw] = useState(() => {
    return Number(localStorage.getItem("bac-schedule-generator-step")) || 1;
  });

  useEffect(() => {
    localStorage.setItem("bac-schedule-generator-step", String(currentStep));
  }, [currentStep]);

  const setCurrentStep = (step: number) => {
    setCurrentStepRaw(step);
  };

  useEffect(() => {
    setSavedState({
      startDate,
      endDate,
      g1Shifts,
      g2Shifts,
      capacityMatrix,
      requestedDaysOff,
      finalSchedule,
      assignedFCs,
      reasoningLog,
    });
  }, [
    startDate,
    endDate,
    g1Shifts,
    g2Shifts,
    capacityMatrix,
    requestedDaysOff,
    finalSchedule,
    assignedFCs,
    reasoningLog,
    setSavedState,
  ]);

  useEffect(() => {
    if (startDate && endDate) {
      const allDays = [];
      const currentDate = new Date(startDate + "T00:00:00");
      const lastDate = new Date(endDate + "T00:00:00");
      while (currentDate <= lastDate) {
        allDays.push(currentDate.toISOString().split("T")[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }
      setDays(allDays);
    } else {
      setDays([]);
    }
  }, [startDate, endDate]);

  const handleCapacityChange = (
    postId: string,
    date: string,
    value: number
  ) => {
    setCapacityMatrix((prev) => ({
      ...prev,
      [postId]: { ...prev[postId], [date]: value },
    }));
  };

  const handleDayOffChange = (
    lifeguardId: string,
    date: string,
    isChecked: boolean
  ) => {
    setRequestedDaysOff((prev) => {
      const updatedDaysOff = { ...(prev[lifeguardId] || {}) };
      if (isChecked) updatedDaysOff[date] = true;
      else delete updatedDaysOff[date];
      return { ...prev, [lifeguardId]: updatedDaysOff };
    });
  };

  const handleGenerateSchedule = () => {
    if (
      !startDate ||
      !endDate ||
      posts.length === 0 ||
      lifeguards.length === 0
    ) {
      alert(
        "Por favor, preencha as datas, e certifique-se de que há gvcs e postos cadastrados."
      );
      return;
    }

    const g1Count = lifeguards.filter((lg) => lg.group === "G1").length;
    const g2Count = lifeguards.filter((lg) => lg.group === "G2").length;

    const totalTableVacancies = days.reduce((total, day) => {
      return (
        total +
        posts.reduce((dayTotal, post) => {
          return dayTotal + (capacityMatrix[post.id]?.[day] || 0);
        }, 0)
      );
    }, 0);

    const totalRequestedDaysOff = Object.values(requestedDaysOff).reduce(
      (total, dailyFlags) => {
        const daysInPeriod = Object.keys(dailyFlags).filter((date) =>
          days.includes(date)
        );
        return total + daysInPeriod.length;
      },
      0
    );

    const necessaryShifts = totalTableVacancies + totalRequestedDaysOff;
    const allocatedShifts = g1Count * g1Shifts + g2Count * g2Shifts;
    const surplus = Math.max(0, allocatedShifts - necessaryShifts);

    const config = {
      period: { startDate, endDate },
      shiftQuotas: { G1: g1Shifts, G2: g2Shifts },
      capacityMatrix,
      requestedDaysOff,
      lifeguards,
      posts,
      surplus,
    };

    const { schedule, compulsoryDaysOff, reasoningLog } =
      generateSchedule(config);

    setFinalSchedule(schedule);
    setReasoningLog(reasoningLog);
    setAssignedFCs(compulsoryDaysOff);
    setCurrentStep(5);
  };

  const handleSaveToHistory = () => {
    if (!finalSchedule || !assignedFCs || !reasoningLog) {
      alert("Nenhuma escala foi gerada para salvar.");
      return;
    }

    const defaultName = `Escala de ${startDate} a ${endDate}`;
    const scheduleName = prompt(
      "Digite um nome para esta escala:",
      defaultName
    );

    if (!scheduleName) {
      return;
    }

    const newSavedSchedule: SavedSchedule = {
      id: crypto.randomUUID(),
      name: scheduleName,
      savedAt: new Date().toISOString(),
      inputs: {
        startDate,
        endDate,
        g1Shifts,
        g2Shifts,
        capacityMatrix,
        requestedDaysOff,
        snapshotLifeguards: lifeguards,
        snapshotPosts: posts,
      },
      outputs: {
        schedule: finalSchedule,
        compulsoryDaysOff: assignedFCs,
        reasoningLog: reasoningLog,
      },
    };

    setScheduleHistory([...scheduleHistory, newSavedSchedule]);
    alert(`Escala "${scheduleName}" salva com sucesso no histórico!`);
  };

  const handleClearState = () => {
    if (
      window.confirm(
        "Tem certeza que deseja limpar todos os dados e recomeçar?"
      )
    ) {
      setSavedState(null);
      setStartDate("");
      setEndDate("");
      setG1Shifts(11);
      setG2Shifts(10);
      setCapacityMatrix({});
      setRequestedDaysOff({});
      setFinalSchedule(null);
      setAssignedFCs(null);
      setReasoningLog(null);
      setCurrentStep(1);
    }
  };

  const goToNextStep = () => {
    if (currentStep === 1 && (!startDate || !endDate)) {
      alert(
        "Por favor, selecione as datas de início e término antes de avançar."
      );
      return;
    }
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const goToPreviousStep = () => {
    setCurrentStep(currentStep - 1);
  };

  const lifeguardsByPost = useMemo(() => {
    const grouped: { [postId: string]: Lifeguard[] } = {};
    const unassigned: Lifeguard[] = [];

    for (const lifeguard of lifeguards) {
      const prefA = lifeguard.preferenceA_id;
      if (prefA) {
        if (!grouped[prefA]) grouped[prefA] = [];
        grouped[prefA].push(lifeguard);
      } else {
        unassigned.push(lifeguard);
      }
    }

    for (const postId in grouped) {
      grouped[postId].sort((a, b) => a.rank - b.rank);
    }
    if (unassigned.length > 0)
      grouped["unassigned"] = unassigned.sort((a, b) => a.rank - b.rank);

    return grouped;
  }, [lifeguards]);

  const renderStepContent = () => {
    const g1Count = lifeguards.filter((lg) => lg.group === "G1").length;
    const g2Count = lifeguards.filter((lg) => lg.group === "G2").length;

    const totalTableVacancies = days.reduce((total, day) => {
      return (
        total +
        posts.reduce((dayTotal, post) => {
          return dayTotal + (capacityMatrix[post.id]?.[day] || 0);
        }, 0)
      );
    }, 0);

    const totalRequestedDaysOff = Object.values(requestedDaysOff).reduce(
      (total, dailyFlags) => {
        const daysInPeriod = Object.keys(dailyFlags).filter((date) =>
          days.includes(date)
        );
        return total + daysInPeriod.length;
      },
      0
    );

    const necessaryShifts = totalTableVacancies + totalRequestedDaysOff;
    const allocatedShifts = g1Count * g1Shifts + g2Count * g2Shifts;
    const balance = allocatedShifts - necessaryShifts;

    const handleSuggestG2Shifts = () => {
      if (g2Count === 0) return;

      const necessaryWorkDaysForG2 = necessaryShifts - g1Count * g1Shifts;
      let suggestedG2Shifts = Math.ceil(necessaryWorkDaysForG2 / g2Count);

      if (suggestedG2Shifts < 0) {
        suggestedG2Shifts = 0;
      }

      if (suggestedG2Shifts > g1Shifts) {
        setG2Shifts(g1Shifts);
      } else {
        setG2Shifts(suggestedG2Shifts);
      }
    };

    switch (currentStep) {
      case 1:
        return (
          <div className="w-full max-w-lg mx-auto">
            <h2 className="text-xl font-bold mb-6 text-gray-700 text-center">
              1. Configurações da Quinzena
            </h2>
            <div className="space-y-6">
              <div>
                <label
                  htmlFor="start-date"
                  className="block text-sm font-medium text-gray-600 mb-1"
                >
                  Data de Início
                </label>
                <input
                  type="date"
                  id="start-date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label
                  htmlFor="end-date"
                  className="block text-sm font-medium text-gray-600 mb-1"
                >
                  Data de Término
                </label>
                <input
                  type="date"
                  id="end-date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div>
            <h2 className="text-xl font-bold mb-6 text-gray-700 text-center">
              2. Folgas Solicitadas
            </h2>

            <div className="overflow-x-auto max-h-[500px]">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="sticky left-0 top-0 bg-white z-30 px-2 sm:px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Nome
                    </th>
                    {days.map((day) => {
                      const date = new Date(day + "T00:00:00");
                      const dayOfMonth = date
                        .getDate()
                        .toString()
                        .padStart(2, "0");
                      const dayOfWeek = date
                        .toLocaleDateString("pt-BR", { weekday: "short" })
                        .replace(".", "");
                      return (
                        <th
                          key={day}
                          className="sticky top-0 bg-white z-20 px-2 sm:px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider"
                        >
                          <span>{dayOfWeek}</span>
                          <span className="block">{dayOfMonth}</span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {lifeguards
                    .sort((a, b) => a.rank - b.rank)
                    .map((lifeguard) => (
                      <tr
                        key={lifeguard.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="sticky max-w-80 left-0 bg-white hover:bg-gray-50 z-10 px-2 sm:px-4 py-4 flex items-center gap-2 text-sm font-medium text-gray-800">
                          <span className="font-bold text-gray-500 mr-2">
                            {lifeguard.rank}º
                          </span>
                          <span className="truncate">{lifeguard.name}</span>
                        </td>
                        {days.map((day) => (
                          <td
                            key={day}
                            className="px-2 sm:px-4 py-4 text-center"
                          >
                            <input
                              type="checkbox"
                              checked={!!requestedDaysOff[lifeguard.id]?.[day]}
                              onChange={(e) =>
                                handleDayOffChange(
                                  lifeguard.id,
                                  day,
                                  e.target.checked
                                )
                              }
                              className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 3:
        return (
          <div>
            <h2 className="text-xl font-bold mb-6 text-gray-700 text-center">
              3. Vagas e Diárias
            </h2>

            <div className="space-y-8">
              <div className="bg-gray-50 p-4 rounded-lg shadow-inner">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-4 rounded-lg border">
                    <h4 className="font-bold text-gray-700">Grupo G1</h4>
                    <p className="text-sm text-gray-600">
                      Efetivo: <span className="font-semibold">{g1Count}</span>
                    </p>
                    <label
                      htmlFor="g1-shifts"
                      className="block text-sm font-medium text-gray-600 mt-2"
                    >
                      Diárias / GVC
                    </label>
                    <input
                      type="number"
                      id="g1-shifts"
                      value={g1Shifts}
                      onChange={(e) =>
                        setG1Shifts(parseInt(e.target.value, 10) || 0)
                      }
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div className="bg-white p-4 rounded-lg border">
                    <h4 className="font-bold text-gray-700">Grupo G2</h4>
                    <p className="text-sm text-gray-600">
                      Efetivo: <span className="font-semibold">{g2Count}</span>
                    </p>
                    <label
                      htmlFor="g2-shifts"
                      className="block text-sm font-medium text-gray-600 mt-2"
                    >
                      Diárias / GVC
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        id="g2-shifts"
                        value={g2Shifts}
                        onChange={(e) =>
                          setG2Shifts(parseInt(e.target.value, 10) || 0)
                        }
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                      />
                      <Button.Root>
                        <Button.ButtonComponent
                          onClick={handleSuggestG2Shifts}
                          title="Calcular diárias para G2 de forma otimizada"
                        >
                          Sugerir
                        </Button.ButtonComponent>
                      </Button.Root>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg border">
                    <h4 className="font-bold text-gray-700 mb-2">
                      Calculadora de Diárias
                    </h4>
                    <div className="text-sm space-y-2">
                      <p className="flex justify-between">
                        <span>Vagas na Tabela:</span>
                        <span className="font-bold">{totalTableVacancies}</span>
                      </p>
                      <p className="flex justify-between">
                        <span>Folgas Solicitadas:</span>
                        <span className="font-bold">
                          {totalRequestedDaysOff}
                        </span>
                      </p>
                      <p className="flex justify-between font-semibold">
                        <span>Diárias Necessárias:</span>
                        <span className="font-bold">{necessaryShifts}</span>
                      </p>
                      <p className="flex justify-between">
                        <span>Diárias Alocadas:</span>
                        <span className="font-bold">{allocatedShifts}</span>
                      </p>
                      <hr className="my-1" />
                      <p
                        className={`flex justify-between font-bold text-base ${
                          balance < 0 ? "text-red-500" : "text-green-500"
                        }`}
                      >
                        <span>Saldo:</span>
                        <span>{balance > 0 ? `+${balance}` : balance}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-white">
                    <tr>
                      <th className="sticky left-0 bg-white z-10 px-2 sm:px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Posto
                      </th>
                      {days.map((day) => {
                        const date = new Date(day + "T00:00:00");
                        const dayOfMonth = date
                          .getDate()
                          .toString()
                          .padStart(2, "0");
                        const dayOfWeek = date
                          .toLocaleDateString("pt-BR", { weekday: "short" })
                          .replace(".", "");
                        return (
                          <th
                            key={day}
                            className="px-2 sm:px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider"
                          >
                            <span>{dayOfWeek}</span>
                            <span className="block">{dayOfMonth}</span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {posts
                      .sort((a, b) => a.order - b.order)
                      .map((post) => (
                        <tr key={post.id} className="hover:bg-gray-50">
                          <td className="sticky left-0 bg-white hover:bg-gray-50 z-10 px-2 sm:px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-800">
                            {post.name}
                          </td>
                          {days.map((day) => (
                            <td key={day} className="px-1 sm:px-2 py-1">
                              <input
                                type="number"
                                min="0"
                                value={capacityMatrix[post.id]?.[day] || ""}
                                onChange={(e) =>
                                  handleCapacityChange(
                                    post.id,
                                    day,
                                    parseInt(e.target.value, 10) || 0
                                  )
                                }
                                className="w-15 text-center p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                  </tbody>
                  <tfoot className="bg-gray-100">
                    <tr className="font-bold text-gray-600">
                      <td className="sticky left-0 bg-gray-100 z-10 px-2 sm:px-4 py-3 text-right text-xs uppercase">
                        Total Diário
                      </td>
                      {days.map((day) => {
                        const dailyTotal = posts.reduce((total, post) => {
                          return total + (capacityMatrix[post.id]?.[day] || 0);
                        }, 0);
                        return (
                          <td
                            key={day}
                            className="px-2 sm:px-4 py-3 text-center text-sm"
                          >
                            {dailyTotal}
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <FaCheck />
            </div>

            <h2 className="text-2xl font-bold mb-2 text-gray-800">
              Tudo Pronto!
            </h2>
            <p className="text-gray-600 mb-8 max-w-md">
              Revise o resumo abaixo. Se tudo estiver correto, clique em "Gerar
              Escala" para iniciar o processamento.
            </p>

            <div className="w-full max-w-md bg-gray-50 p-4 border border-gray-200 rounded-lg text-left">
              <h3 className="text-lg font-semibold text-gray-700 mb-3 pb-2 border-b">
                Resumo da Configuração
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Período:</span>
                  <span className="font-medium text-gray-800">
                    {new Date(startDate + "T00:00:00").toLocaleDateString(
                      "pt-BR"
                    )}{" "}
                    a{" "}
                    {new Date(endDate + "T00:00:00").toLocaleDateString(
                      "pt-BR"
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total de GVC:</span>
                  <span className="font-medium text-gray-800">
                    {lifeguards.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Diárias G1 / GVC:</span>
                  <span className="font-medium text-gray-800">{g1Shifts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Diárias G2 / GVC:</span>
                  <span className="font-medium text-gray-800">{g2Shifts}</span>
                </div>
              </div>
            </div>
          </div>
        );
      case 5:
        if (!finalSchedule) {
          return (
            <div className="text-center p-8 flex flex-col items-center justify-center h-full">
              <h3 className="text-xl font-bold text-red-600 mb-2">
                Ocorreu um Erro
              </h3>
              <p className="text-gray-600">
                Nenhuma escala foi gerada. Por favor, volte aos passos
                anteriores para gerar uma.
              </p>
            </div>
          );
        }
        return (
          <div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
              <h2 className="text-xl font-bold text-gray-700 text-center sm:text-left">
                5. Escala Final Gerada
              </h2>
              <div className="flex items-center justify-center gap-2">
                <Button.Root>
                  <Button.ButtonComponent
                    variant="secondary"
                    onClick={() => setIsLogModalOpen(true)}
                  >
                    <Button.Icon icon={FaList} />
                    Ver Log
                  </Button.ButtonComponent>
                </Button.Root>
                <Button.Root>
                  <Button.ButtonComponent
                    variant="primary"
                    onClick={handleSaveToHistory}
                  >
                    <Button.Icon icon={FaFloppyDisk} />
                    Salvar
                  </Button.ButtonComponent>
                </Button.Root>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-white z-20 shadow-md">
                  <tr>
                    <th
                      className="sticky left-0 bg-white z-30 px-2 sm:px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                      style={{ width: "180px" }}
                    >
                      Nome
                    </th>
                    <th className="px-2 sm:px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider md:sticky md:bg-white md:z-30">
                      Rank
                    </th>
                    {days.map((day) => {
                      const date = new Date(`${day}T00:00:00`);
                      const dayOfMonth = date
                        .getDate()
                        .toString()
                        .padStart(2, "0");
                      const dayOfWeek = date
                        .toLocaleDateString("pt-BR", { weekday: "short" })
                        .replace(".", "");
                      return (
                        <th
                          key={day}
                          className="px-2 sm:px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider"
                        >
                          <span>{dayOfWeek}</span>
                          <span className="block">{dayOfMonth}</span>
                        </th>
                      );
                    })}
                    <th className="px-2 sm:px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {posts
                    .sort((a, b) => a.order - b.order)
                    .map((post) => {
                      const postLifeguards = lifeguardsByPost[post.id] || [];
                      if (postLifeguards.length === 0) return null;

                      return (
                        <React.Fragment key={`post-group-${post.id}`}>
                          <tr>
                            <td
                              colSpan={days.length + 3}
                              className="p-2 bg-blue-50 font-bold text-base"
                            >
                              {post.name}
                            </td>
                          </tr>

                          {postLifeguards.map((lifeguard) => {
                            const workScheduleMap = new Map<string, string>();
                            let workCount = 0;
                            for (const day of days) {
                              for (const postId in finalSchedule[day]) {
                                if (
                                  finalSchedule[day][postId].some(
                                    (lg) => lg.id === lifeguard.id
                                  )
                                ) {
                                  workScheduleMap.set(day, postId);
                                  workCount++;
                                  break;
                                }
                              }
                            }

                            return (
                              <tr
                                key={lifeguard.id}
                                className="hover:bg-gray-50"
                              >
                                <td
                                  className="sticky left-0 bg-white hover:bg-gray-50 z-10 px-2 sm:px-4 py-2 text-sm font-medium text-gray-800"
                                  style={{ width: "180px" }}
                                >
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="truncate"
                                      title={lifeguard.name}
                                    >
                                      {lifeguard.name}
                                    </span>
                                  </div>
                                </td>
                                <td
                                  className="px-2 sm:px-4 py-2 text-center text-sm md:sticky md:bg-white md:hover:bg-gray-50 md:z-10"
                                  style={{ left: "180px" }}
                                >
                                  {lifeguard.rank}º
                                </td>
                                {days.map((day) => {
                                  const workingPostId =
                                    workScheduleMap.get(day);
                                  const isRequestedOff =
                                    requestedDaysOff[lifeguard.id]?.[day];
                                  const isCompulsoryOff =
                                    assignedFCs?.[lifeguard.id]?.[day];

                                  let cellContent: React.ReactNode = "--";
                                  const cellClass = "text-center font-mono";
                                  let bgClass = "";

                                  if (workingPostId) {
                                    if (workingPostId === post.id) {
                                      cellContent = "X";
                                    } else {
                                      const workingPost = posts.find(
                                        (p) => p.id === workingPostId
                                      );
                                      cellContent = `XP${
                                        workingPost?.name.replace(
                                          "Posto ",
                                          ""
                                        ) || "?"
                                      }`;
                                      bgClass = "bg-blue-100";
                                    }
                                  } else if (isCompulsoryOff) {
                                    cellContent = "FC";
                                  } else if (isRequestedOff) {
                                    cellContent = "FS";
                                    bgClass = "bg-red-100";
                                  }

                                  return (
                                    <td
                                      key={day}
                                      className={`p-2 ${cellClass} ${bgClass}`}
                                    >
                                      {cellContent}
                                    </td>
                                  );
                                })}
                                {(() => {
                                  const quota =
                                    lifeguard.group === "G1"
                                      ? g1Shifts
                                      : g2Shifts;

                                  const requestedOffCount = Object.keys(
                                    requestedDaysOff[lifeguard.id] || {}
                                  ).filter((date) =>
                                    days.includes(date)
                                  ).length;
                                  const maxPossibleWorkDays =
                                    days.length - requestedOffCount;
                                  const targetWorkDays = Math.min(
                                    quota,
                                    maxPossibleWorkDays
                                  );

                                  const totalBgClass =
                                    workCount < targetWorkDays
                                      ? "bg-orange-100 text-orange-800"
                                      : "bg-gray-100";
                                  return (
                                    <td
                                      className={`px-2 sm:px-4 py-2 text-center font-bold ${totalBgClass}`}
                                    >
                                      {workCount}
                                    </td>
                                  );
                                })()}
                              </tr>
                            );
                          })}

                          <tr className="bg-gray-200 font-bold">
                            <td
                              colSpan={2}
                              className="px-2 sm:px-4 py-2 text-right text-xs uppercase text-gray-600"
                            >
                              Total no Posto:
                            </td>
                            {days.map((day) => {
                              const dailyTotal =
                                finalSchedule[day]?.[post.id]?.length || 0;
                              const requiredTotal =
                                capacityMatrix[post.id]?.[day] || 0;
                              const isDeficit = dailyTotal < requiredTotal;

                              return (
                                <td
                                  key={`total-${day}`}
                                  className={`p-2 text-center text-xs ${
                                    isDeficit
                                      ? "bg-red-200 text-red-800"
                                      : "text-gray-700"
                                  }`}
                                >
                                  {dailyTotal}/{requiredTotal}
                                </td>
                              );
                            })}
                            <td className="p-2"></td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        );

      default:
        return <div>Passo inválido</div>;
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 md:p-8">
      <div className="flex">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
          Gerador de Escala
        </h1>
      </div>
      <div className="mt-8 bg-white rounded-lg shadow-md">
        <div className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-gray-200">
          <Button.Root>
            <Button.ButtonComponent
              variant="secondary"
              onClick={goToPreviousStep}
              disabled={currentStep === 1}
              className={
                currentStep == 1 ? "text-transparent hover:bg-transparent" : ""
              }
            >
              <Button.Icon icon={FaArrowLeft} />
              Voltar
            </Button.ButtonComponent>
          </Button.Root>

          <div className="flex self-end gap-2 sm:gap-4">
            {currentStep === 1 && (
              <Button.Root>
                <Button.ButtonComponent onClick={handleClearState}>
                  <Button.Icon icon={FaBroom} />
                  Limpar
                </Button.ButtonComponent>
              </Button.Root>
            )}

            {currentStep < 4 ? (
              <Button.Root>
                <Button.ButtonComponent
                  variant="primary"
                  onClick={goToNextStep}
                >
                  Próximo
                  <Button.Icon icon={FaArrowRight} />
                </Button.ButtonComponent>
              </Button.Root>
            ) : currentStep === 4 ? (
              <Button.Root>
                <Button.ButtonComponent
                  onClick={handleGenerateSchedule}
                  className="text-lg"
                >
                  <Button.Icon icon={FaPlay} />
                  Gerar Escala
                </Button.ButtonComponent>
              </Button.Root>
            ) : null}
          </div>
        </div>

        <div className="p-6 min-h-[400px] flex flex-col justify-center">
          {renderStepContent()}
        </div>
      </div>

      <LogViewerModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        log={reasoningLog}
        lifeguards={lifeguards}
        days={days}
      />
    </div>
  );
}
