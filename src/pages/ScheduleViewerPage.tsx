import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { type SavedSchedule } from "../types/SavedSchedule";
import { type Lifeguard } from "../types/Lifeguard";
import { type EditContext } from "../types/EditContext";
import EditShiftModal from "../components/modals/EditShiftModal";
import LogViewerModal from "../components/modals/LogViewModal";
import * as Button from "../components/ui/Button";
import { FaArrowLeft, FaCopy, FaList, FaRepeat } from "react-icons/fa6";
import TriangulationModal, {
  type TriangulationOpportunity,
} from "../components/modals/TriangulationModal";
import DonorSelectionModal from "../components/modals/DonorSelectionModal";

import SecondaryDonorSelectionModal from "../components/modals/SecondaryDonorSelectionModal";

export default function ScheduleViewerPage() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();

  const [scheduleHistory, setScheduleHistory] = useLocalStorage<
    SavedSchedule[]
  >("bac-schedule-history", []);

  const [scheduleData, setScheduleData] = useState<SavedSchedule | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [editingContext, setEditingContext] = useState<EditContext | null>(
    null
  );

  const [isTriangulationModalOpen, setIsTriangulationModalOpen] =
    useState(false);
  const [selectedOpportunity, setSelectedOpportunity] =
    useState<TriangulationOpportunity | null>(null);

  const [isDonorSelectionModalOpen, setIsDonorSelectionModalOpen] =
    useState(false);
  const [opportunitiesForSelection, setOpportunitiesForSelection] = useState<
    TriangulationOpportunity[]
  >([]);

  const [isSecondaryDonorModalOpen, setIsSecondaryDonorModalOpen] =
    useState(false);
  const [
    secondaryOpportunitiesForSelection,
    setSecondaryOpportunitiesForSelection,
  ] = useState<TriangulationOpportunity[]>([]);

  useEffect(() => {
    const data = scheduleHistory.find((s) => s.id === scheduleId);
    if (data) {
      setScheduleData(JSON.parse(JSON.stringify(data)));
    } else {
      alert("Escala não encontrada!");
      navigate("/history");
    }
  }, [scheduleId, scheduleHistory, navigate]);

  const days = useMemo(() => {
    if (!scheduleData?.inputs.startDate || !scheduleData?.inputs.endDate)
      return [];
    const allDays = [];
    const currentDate = new Date(scheduleData.inputs.startDate + "T00:00:00");
    const lastDate = new Date(scheduleData.inputs.endDate + "T00:00:00");
    while (currentDate <= lastDate) {
      allDays.push(currentDate.toISOString().split("T")[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return allDays;
  }, [scheduleData]);

  const lifeguardsByPost = useMemo(() => {
    if (!scheduleData) return {};
    const grouped: { [postId: string]: Lifeguard[] } = {};
    const unassigned: Lifeguard[] = [];

    for (const lifeguard of scheduleData.inputs.snapshotLifeguards) {
      const prefA = lifeguard.preferenceA_id;
      if (
        prefA &&
        scheduleData?.inputs.snapshotPosts.some((p) => p.id === prefA)
      ) {
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
  }, [scheduleData]);

  const deficitByDay = useMemo(() => {
    if (!scheduleData) return new Map<string, Set<string>>();
    const deficitMap = new Map<string, Set<string>>();

    for (const day of days) {
      const postsWithDeficit = new Set<string>();
      for (const post of scheduleData.inputs.snapshotPosts) {
        const dailyTotal =
          scheduleData.outputs.schedule[day]?.[post.id]?.length || 0;
        const requiredTotal =
          scheduleData.inputs.capacityMatrix[post.id]?.[day] || 0;
        if (dailyTotal < requiredTotal) {
          postsWithDeficit.add(post.id);
        }
      }
      if (postsWithDeficit.size > 0) {
        deficitMap.set(day, postsWithDeficit);
      }
    }
    return deficitMap;
  }, [days, scheduleData]);

  const { donorsA, donorsB } = useMemo(() => {
    const result: { donorsA: Lifeguard[]; donorsB: Lifeguard[] } = {
      donorsA: [],
      donorsB: [],
    };

    if (!scheduleData || deficitByDay.size === 0) {
      return result;
    }

    const { compulsoryDaysOff } = scheduleData.outputs;
    const { snapshotLifeguards } = scheduleData.inputs;

    for (const lifeguard of snapshotLifeguards) {
      const lifeguardCompulsoryOffs = compulsoryDaysOff[lifeguard.id];
      if (!lifeguardCompulsoryOffs) continue;

      let isDonorA = false;
      let isDonorB = false;

      // Itera nos dias de folga do GVC
      for (const day in lifeguardCompulsoryOffs) {
        const postsWithDeficitOnDay = deficitByDay.get(day);

        if (postsWithDeficitOnDay) {
          // Verifica se o déficit é no seu Posto de Preferência A
          if (
            lifeguard.preferenceA_id &&
            postsWithDeficitOnDay.has(lifeguard.preferenceA_id)
          ) {
            isDonorA = true;
            break; // Prioridade máxima, pode parar de verificar os dias
          }
          // Se não, marca como um possível doador tipo B
          isDonorB = true;
        }
      }

      // Adiciona o GVC à lista apropriada após checar todos os seus dias
      if (isDonorA) {
        result.donorsA.push(lifeguard);
      } else if (isDonorB) {
        result.donorsB.push(lifeguard);
      }
    }

    return result;
  }, [scheduleData, deficitByDay]);

  const { receiversA, receiversB } = useMemo(() => {
    const result: { receiversA: Lifeguard[]; receiversB: Lifeguard[] } = {
      receiversA: [],
      receiversB: [],
    };

    const allPotentialDonors = [...donorsA, ...donorsB];
    if (!scheduleData || allPotentialDonors.length === 0) {
      return result;
    }

    const { snapshotLifeguards, g1Shifts, g2Shifts, requestedDaysOff } =
      scheduleData.inputs;
    const { schedule: finalSchedule } = scheduleData.outputs;

    // Mapa contendo APENAS doadores do tipo A, por posto
    const donorsAByPA = new Map<string, Lifeguard[]>();
    for (const donor of donorsA) {
      if (donor.preferenceA_id) {
        if (!donorsAByPA.has(donor.preferenceA_id)) {
          donorsAByPA.set(donor.preferenceA_id, []);
        }
        donorsAByPA.get(donor.preferenceA_id)!.push(donor);
      }
    }

    // Mapa contendo TODOS os doadores, por posto
    const allDonorsByPA = new Map<string, Lifeguard[]>();
    for (const donor of allPotentialDonors) {
      if (donor.preferenceA_id) {
        if (!allDonorsByPA.has(donor.preferenceA_id)) {
          allDonorsByPA.set(donor.preferenceA_id, []);
        }
        allDonorsByPA.get(donor.preferenceA_id)!.push(donor);
      }
    }

    for (const lifeguard of snapshotLifeguards) {
      const quota = lifeguard.group === "G1" ? g1Shifts : g2Shifts;

      let workCount = 0;
      for (const day of days) {
        for (const postId in finalSchedule[day]) {
          if (finalSchedule[day][postId].some((lg) => lg.id === lifeguard.id)) {
            workCount++;
            break;
          }
        }
      }

      const requestedDaysOffInPeriod = days.filter(
        (day) => requestedDaysOff[lifeguard.id]?.[day]
      ).length;

      // Se o salva-vidas tem déficit de diárias
      if (workCount + requestedDaysOffInPeriod < quota) {
        const prefA = lifeguard.preferenceA_id;
        if (!prefA) continue;

        // 1. Condição para Receiver A: existe um Doador A no mesmo posto
        if (donorsAByPA.has(prefA)) {
          result.receiversA.push(lifeguard);
        }
        // 2. Condição para Receiver B: não é Receiver A, mas existe algum outro doador
        else if (allDonorsByPA.has(prefA)) {
          result.receiversB.push(lifeguard);
        }
      }
    }

    return result;
  }, [scheduleData, donorsA, donorsB, days]);

  const secondaryTriangulationOpportunities = useMemo(() => {
    const opportunitiesMap = new Map<string, TriangulationOpportunity[]>();
    if (!scheduleData || donorsB.length === 0 || receiversB.length === 0) {
      return opportunitiesMap;
    }

    const { compulsoryDaysOff, schedule } = scheduleData.outputs;
    const { snapshotPosts, requestedDaysOff } = scheduleData.inputs;
    const allWorkMap = new Map<string, string>();

    for (const day of days) {
      for (const postId in schedule[day]) {
        for (const lifeguard of schedule[day][postId]) {
          allWorkMap.set(`${lifeguard.id}-${day}`, postId);
        }
      }
    }

    for (const receiver of receiversB) {
      for (const donor of donorsB) {
        if (receiver.id === donor.id) continue;

        const donorOffDays = compulsoryDaysOff[donor.id];
        if (!donorOffDays) continue;

        for (const donationDay in donorOffDays) {
          const deficitPosts = deficitByDay.get(donationDay);
          if (!deficitPosts) continue;

          for (const deficitPostId of deficitPosts) {
            if (deficitPostId === donor.preferenceA_id) continue;

            for (const receiverWorkDay of days) {
              if (receiverWorkDay === donationDay) continue;

              const isReceiverOff =
                !allWorkMap.has(`${receiver.id}-${receiverWorkDay}`) &&
                !compulsoryDaysOff[receiver.id]?.[receiverWorkDay] &&
                !requestedDaysOff[receiver.id]?.[receiverWorkDay];

              const donorWorkPostId = allWorkMap.get(
                `${donor.id}-${receiverWorkDay}`
              );

              if (isReceiverOff && donorWorkPostId) {
                const postToWork = snapshotPosts.find(
                  (p) => p.id === deficitPostId
                );
                if (postToWork) {
                  const opportunity: TriangulationOpportunity = {
                    donor,
                    receiver,
                    donationDay,
                    receiverWorkDay,
                    postToWork,
                    donorOriginalWorkPostId: donorWorkPostId,
                  };

                  if (!opportunitiesMap.has(receiver.id)) {
                    opportunitiesMap.set(receiver.id, []);
                  }
                  opportunitiesMap.get(receiver.id)!.push(opportunity);
                }
              }
            }
          }
        }
      }
    }
    return opportunitiesMap;
  }, [scheduleData, donorsB, receiversB, deficitByDay, days]);

  const receiverA_Ids = useMemo(() => {
    return new Set(receiversA.map((lg) => lg.id));
  }, [receiversA]);

  const receiverB_Ids = useMemo(() => {
    return new Set(receiversB.map((lg) => lg.id));
  }, [receiversB]);

  const triangulationOpportunities = useMemo(() => {
    const opportunitiesMap = new Map<string, TriangulationOpportunity[]>();
    if (!scheduleData || donorsA.length === 0 || receiversA.length === 0) {
      return opportunitiesMap;
    }

    const { compulsoryDaysOff, schedule } = scheduleData.outputs;
    const { snapshotPosts, requestedDaysOff } = scheduleData.inputs;
    const allWorkMap = new Map<string, string>(); // gvcId-day -> postId

    // Mapeia onde cada GVC trabalha em cada dia para busca rápida
    for (const day of days) {
      for (const postId in schedule[day]) {
        for (const lifeguard of schedule[day][postId]) {
          allWorkMap.set(`${lifeguard.id}-${day}`, postId);
        }
      }
    }

    for (const receiver of receiversA) {
      const postPreferenceId = receiver.preferenceA_id;
      if (!postPreferenceId) continue;

      const potentialDonors = donorsA.filter(
        (d) => d.preferenceA_id === postPreferenceId && d.id !== receiver.id
      );

      for (const donor of potentialDonors) {
        const donorOffDays = compulsoryDaysOff[donor.id];
        if (!donorOffDays) continue;

        // 1. Encontra o 'donationDay' (dia que o doador cede a FC)
        for (const donationDay in donorOffDays) {
          if (deficitByDay.get(donationDay)?.has(postPreferenceId)) {
            // 2. Agora, encontra o 'receiverWorkDay' (dia para a troca)
            for (const receiverWorkDay of days) {
              if (receiverWorkDay === donationDay) continue;

              const isReceiverOff =
                !allWorkMap.has(`${receiver.id}-${receiverWorkDay}`) &&
                !compulsoryDaysOff[receiver.id]?.[receiverWorkDay] &&
                !requestedDaysOff[receiver.id]?.[receiverWorkDay];

              const donorWorkPostId = allWorkMap.get(
                `${donor.id}-${receiverWorkDay}`
              );

              // Se o receptor está livre E o doador está trabalhando, achamos a troca!
              if (isReceiverOff && donorWorkPostId) {
                const postToWork = snapshotPosts.find(
                  (p) => p.id === postPreferenceId
                );
                if (postToWork) {
                  const opportunity: TriangulationOpportunity = {
                    donor,
                    receiver,
                    donationDay,
                    receiverWorkDay,
                    postToWork,
                    donorOriginalWorkPostId: donorWorkPostId,
                  };

                  if (!opportunitiesMap.has(receiver.id)) {
                    opportunitiesMap.set(receiver.id, []);
                  }
                  opportunitiesMap.get(receiver.id)!.push(opportunity);
                  // Para simplificar, pegamos apenas a primeira oportunidade de troca encontrada
                  break;
                }
              }
            }
          }
        }
      }
    }

    return opportunitiesMap;
  }, [scheduleData, donorsA, receiversA, deficitByDay, days]);

  if (!scheduleData) {
    return (
      <div className="container mx-auto p-6 text-center">
        Carregando escala...
      </div>
    );
  }

  const handleCellClick = (lifeguard: Lifeguard, day: string) => {
    const reasoning =
      scheduleData?.outputs.reasoningLog?.[lifeguard.id]?.[day] || null;

    setEditingContext({
      lifeguardId: lifeguard.id,
      lifeguardName: lifeguard.name,
      day,
      preferenceAPostId: lifeguard.preferenceA_id,
      reasoning,
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateShift = (
    action: { type: "setDayOff" } | { type: "setWork"; postId: string }
  ) => {
    if (!scheduleData || !editingContext) return;

    const { lifeguardId, day } = editingContext;
    const newSchedule = { ...scheduleData.outputs.schedule };
    const newLog = { ...scheduleData.outputs.reasoningLog };

    for (const postId in newSchedule[day]) {
      newSchedule[day][postId] = newSchedule[day][postId].filter(
        (lg) => lg.id !== lifeguardId
      );
    }

    if (!newLog[lifeguardId]) newLog[lifeguardId] = {};

    const posts = scheduleData.inputs.snapshotPosts;
    const lifeguards = scheduleData.inputs.snapshotLifeguards;

    if (action.type === "setWork") {
      const lifeguard = lifeguards.find((lg) => lg.id === lifeguardId);
      if (lifeguard) {
        if (!newSchedule[day][action.postId]) {
          newSchedule[day][action.postId] = [];
        }
        newSchedule[day][action.postId].push(lifeguard);

        const postName = posts.find((p) => p.id === action.postId)?.name || "";
        newLog[lifeguardId][day] = {
          status: "Edição Manual",
          details: `Alocado manualmente no ${postName}.`,
        };
      }
    } else {
      newLog[lifeguardId][day] = {
        status: "Edição Manual",
        details: "Definido como folga manualmente.",
      };
    }

    setScheduleData({
      ...scheduleData,
      outputs: {
        ...scheduleData.outputs,
        schedule: newSchedule,
        reasoningLog: newLog,
      },
    });

    setIsEditModalOpen(false);
  };

  const handleSaveAsCopy = () => {
    if (!scheduleData) return;
    const newName = `${
      scheduleData.name
    } - Cópia Editada ${new Date().toLocaleTimeString("pt-BR")}`;
    const newSavedSchedule: SavedSchedule = {
      ...scheduleData,
      id: crypto.randomUUID(),
      name: newName,
      savedAt: new Date().toISOString(),
    };
    setScheduleHistory([...scheduleHistory, newSavedSchedule]);
    alert(`Cópia "${newName}" salva com sucesso!`);
    navigate("/history");
  };

  const handleOpenTriangulation = (receiver: Lifeguard) => {
    const opportunities = triangulationOpportunities.get(receiver.id);

    if (!opportunities || opportunities.length === 0) {
      alert(
        `Nenhuma oportunidade de troca automática encontrada para ${receiver.name}.`
      );
      return;
    }

    // Se há apenas UMA oportunidade, abre o modal de confirmação direto
    if (opportunities.length === 1) {
      setSelectedOpportunity(opportunities[0]);
      setIsTriangulationModalOpen(true);
    }
    // Se há VÁRIAS, abre o novo modal de SELEÇÃO
    else {
      setOpportunitiesForSelection(opportunities);
      setIsDonorSelectionModalOpen(true);
    }
  };

  const handleOpenSecondaryTriangulation = (receiver: Lifeguard) => {
    const opportunities = secondaryTriangulationOpportunities.get(receiver.id);
    if (!opportunities || opportunities.length === 0) {
      alert(
        `Nenhuma oportunidade de troca (entre postos) encontrada para ${receiver.name}.`
      );
      return;
    }

    // Para o fluxo secundário, sempre mostramos o modal de seleção
    setSecondaryOpportunitiesForSelection(opportunities);
    setIsSecondaryDonorModalOpen(true);
  };

  const handleDonorSelected = (opportunity: TriangulationOpportunity) => {
    // Fecha o modal de seleção
    setIsDonorSelectionModalOpen(false);
    // Define a oportunidade escolhida para o modal de confirmação
    setSelectedOpportunity(opportunity);
    // Abre o modal de confirmação
    setIsTriangulationModalOpen(true);
  };

  const handleConfirmTriangulation = (
    opportunity: TriangulationOpportunity
  ) => {
    if (!scheduleData) return;

    const {
      donor,
      receiver,
      donationDay,
      receiverWorkDay,
      postToWork,
      donorOriginalWorkPostId,
    } = opportunity;

    const newSchedule = JSON.parse(
      JSON.stringify(scheduleData.outputs.schedule)
    );
    const newCompulsoryDaysOff = JSON.parse(
      JSON.stringify(scheduleData.outputs.compulsoryDaysOff)
    );
    const newLog = JSON.parse(
      JSON.stringify(scheduleData.outputs.reasoningLog)
    );

    // --- Ações no Dia da Doação (donationDay) ---
    // 1. Remove FC do doador
    if (newCompulsoryDaysOff[donor.id])
      delete newCompulsoryDaysOff[donor.id][donationDay];
    // 2. Coloca o doador para trabalhar no posto com déficit
    if (!newSchedule[donationDay][postToWork.id])
      newSchedule[donationDay][postToWork.id] = [];
    newSchedule[donationDay][postToWork.id].push(donor);

    // --- Ações no Dia da Troca (receiverWorkDay) ---
    // 3. Remove o doador do seu trabalho original
    newSchedule[receiverWorkDay][donorOriginalWorkPostId] = newSchedule[
      receiverWorkDay
    ][donorOriginalWorkPostId].filter((lg: Lifeguard) => lg.id !== donor.id);
    // 4. Adiciona a FC para o doador neste dia
    if (!newCompulsoryDaysOff[donor.id]) newCompulsoryDaysOff[donor.id] = {};
    newCompulsoryDaysOff[donor.id][receiverWorkDay] = {
      reason: "Triangulação",
    };
    // 5. Adiciona o receptor para trabalhar no lugar do doador
    newSchedule[receiverWorkDay][donorOriginalWorkPostId].push(receiver);

    // --- Atualiza Logs ---
    if (!newLog[donor.id]) newLog[donor.id] = {};
    if (!newLog[receiver.id]) newLog[receiver.id] = {};
    newLog[donor.id][donationDay] = {
      status: "Triangulação",
      details: `Trabalhou para ceder folga a ${receiver.name}.`,
    };
    newLog[donor.id][receiverWorkDay] = {
      status: "Triangulação",
      details: `Recebeu FC de ${donationDay} nesta data.`,
    };
    newLog[receiver.id][receiverWorkDay] = {
      status: "Triangulação",
      details: `Recebeu diária via troca com ${donor.name}.`,
    };

    setScheduleData({
      ...scheduleData,
      outputs: {
        ...scheduleData.outputs,
        schedule: newSchedule,
        compulsoryDaysOff: newCompulsoryDaysOff,
        reasoningLog: newLog,
      },
    });

    setIsTriangulationModalOpen(false);
    setSelectedOpportunity(null);
  };

  const { schedule: finalSchedule, compulsoryDaysOff } = scheduleData.outputs;
  const { capacityMatrix, requestedDaysOff, snapshotPosts } =
    scheduleData.inputs;

  return (
    <>
      <div className="container mx-auto p-4 sm:p-6 md:p-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 border-b border-gray-200 pb-4">
            <div className="text-center sm:text-left">
              <h1
                className="text-xl md:text-2xl font-bold text-gray-800 truncate"
                title={scheduleData.name}
              >
                {scheduleData.name}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Salva em:{" "}
                {new Date(scheduleData.savedAt).toLocaleString("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Button.Root>
                <Link to="/history">
                  <Button.ButtonComponent variant="secondary">
                    <Button.Icon icon={FaArrowLeft} />
                    Voltar
                  </Button.ButtonComponent>
                </Link>
              </Button.Root>
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
                  onClick={handleSaveAsCopy}
                >
                  <Button.Icon icon={FaCopy} />
                  Salvar Cópia
                </Button.ButtonComponent>
              </Button.Root>
            </div>
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-[600px] mt-4">
            <p className="text-sm text-gray-500 mb-4 text-center sm:text-left">
              Clique em qualquer célula da escala (X, FC, --, etc.) para fazer
              um ajuste manual.
            </p>
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white z-20 shadow-md">
                <tr>
                  <th
                    className="sticky left-0 bg-white z-30 px-2 sm:px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                    style={{ width: "180px" }}
                  >
                    Salva-Vidas
                  </th>
                  <th
                    className="px-2 sm:px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider md:sticky md:bg-white md:z-30"
                    style={{ left: "180px" }}
                  >
                    Rank
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
                  <th className="px-2 sm:px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {snapshotPosts
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
                          const requestedDaysOffInPeriod = days.filter(
                            (day) => requestedDaysOff[lifeguard.id]?.[day]
                          ).length;

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
                            <tr key={lifeguard.id} className="hover:bg-gray-50">
                              <td
                                className="sticky left-0 bg-white hover:bg-gray-50 z-10 px-2 sm:px-4 py-2 text-sm font-medium text-gray-800"
                                style={{ width: "180px" }}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-gray-500">
                                    {lifeguard.rank}º
                                  </span>
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
                                const workingPostId = workScheduleMap.get(day);
                                const isRequestedOff =
                                  requestedDaysOff[lifeguard.id]?.[day];
                                const isCompulsoryOff =
                                  compulsoryDaysOff[lifeguard.id]?.[day];

                                let cellContent: React.ReactNode = "--";
                                let bgClass = "";
                                let toolTipText = "";

                                if (workingPostId) {
                                  if (workingPostId === post.id) {
                                    cellContent = "X";
                                  } else {
                                    const workingPost = snapshotPosts.find(
                                      (p) => p.id === workingPostId
                                    );
                                    cellContent = `XP${
                                      workingPost?.name.replace("Posto ", "") ||
                                      "?"
                                    }`;
                                    bgClass = "bg-blue-100";
                                  }
                                } else if (isCompulsoryOff) {
                                  cellContent = "FC";
                                  const postsWithDeficitOnDay =
                                    deficitByDay.get(day);
                                  if (postsWithDeficitOnDay) {
                                    if (
                                      lifeguard.preferenceA_id &&
                                      postsWithDeficitOnDay.has(
                                        lifeguard.preferenceA_id
                                      )
                                    ) {
                                      bgClass = "bg-green-200";
                                    } else {
                                      bgClass = "bg-orange-100";
                                      toolTipText =
                                        "Possível troca com outros postos";
                                    }
                                  }
                                } else if (isRequestedOff) {
                                  cellContent = "FS";
                                  bgClass = "bg-red-50";
                                }

                                return (
                                  <td
                                    key={day}
                                    className={`p-2 text-center font-mono cursor-pointer hover:bg-blue-100 transition-colors ${bgClass}`}
                                    onClick={() =>
                                      handleCellClick(lifeguard, day)
                                    }
                                    title={toolTipText}
                                  >
                                    {cellContent}
                                  </td>
                                );
                              })}
                              {(() => {
                                const quota =
                                  lifeguard.group === "G1"
                                    ? scheduleData.inputs.g1Shifts
                                    : scheduleData.inputs.g2Shifts;
                                const totalBgClass =
                                  workCount + requestedDaysOffInPeriod < quota
                                    ? "bg-orange-100 text-orange-800"
                                    : "bg-gray-100";

                                const isReceiverA = receiverA_Ids.has(
                                  lifeguard.id
                                );

                                const isReceiverB = receiverB_Ids.has(
                                  lifeguard.id
                                );

                                return (
                                  <td
                                    className={`px-2 sm:px-4 py-2 text-center font-bold ${totalBgClass}`}
                                  >
                                    <div className="flex items-center justify-center gap-2">
                                      {workCount}
                                      {isReceiverA && (
                                        <button
                                          onClick={() =>
                                            handleOpenTriangulation(lifeguard)
                                          }
                                        >
                                          <FaRepeat
                                            className="text-green-600 hover:text-green-800 cursor-pointer"
                                            title="Otimizar Escala (Doador disponível no posto)"
                                          />
                                        </button>
                                      )}
                                      {isReceiverB && (
                                        <button
                                          onClick={() =>
                                            handleOpenSecondaryTriangulation(
                                              lifeguard
                                            )
                                          }
                                        >
                                          <FaRepeat
                                            className="text-yellow-600 hover:text-yellow-800 cursor-pointer"
                                            title="Otimizar Escala (Doador disponível em outro posto)"
                                          />
                                        </button>
                                      )}
                                    </div>
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
                            const isExcess = dailyTotal > requiredTotal;

                            return (
                              <td
                                key={`total-${day}`}
                                className={`p-2 text-center text-xs ${
                                  isDeficit
                                    ? "bg-red-200 text-red-800"
                                    : isExcess
                                    ? "bg-orange-200 text-orange-800"
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
      </div>

      <EditShiftModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleUpdateShift}
        context={editingContext}
        posts={scheduleData.inputs.snapshotPosts}
      />
      <LogViewerModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        log={scheduleData.outputs.reasoningLog}
        lifeguards={scheduleData.inputs.snapshotLifeguards}
        days={days}
      />

      <TriangulationModal
        isOpen={isTriangulationModalOpen}
        onClose={() => setIsTriangulationModalOpen(false)}
        onConfirm={handleConfirmTriangulation}
        opportunity={selectedOpportunity}
      />

      <DonorSelectionModal
        isOpen={isDonorSelectionModalOpen}
        onClose={() => setIsDonorSelectionModalOpen(false)}
        onSelect={handleDonorSelected}
        opportunities={opportunitiesForSelection}
      />

      <SecondaryDonorSelectionModal
        isOpen={isSecondaryDonorModalOpen}
        onClose={() => setIsSecondaryDonorModalOpen(false)}
        onSelect={handleDonorSelected}
        opportunities={secondaryOpportunitiesForSelection}
        allPosts={scheduleData.inputs.snapshotPosts}
      />
    </>
  );
}
