# BAC - Lifeguard Scaling System / Sistema de Geração de Escalas para Bombeiros

**[English](#english) | [Português](#portugues)**

---

<a name="english"></a>
## 🌊 English Version

### 🚀 Live Demo
🔗 **[View Live App](https://brenobalsini.github.io/BAC-Escalas/)**

### 💻 Project Overview

Automated scheduling system for lifeguard teams. Built to replace manual spreadsheet-based scheduling with an intelligent algorithm that handles preferences, quotas, and constraints.

**Built with:** React • TypeScript • TailwindCSS

### ✨ Key Features

- **Staff Management**: Register lifeguards with position preferences
- **Position Setup**: Configure available service positions
- **Schedule Period**: Define start and end dates for the schedule
- **Smart Algorithm**: Automatically allocates staff based on:
  - Position preferences
  - Required quotas per position
  - Mandatory days off
  - Fair distribution across all positions
- **Schedule History**: Save and review generated schedules

### 🧠 How the Algorithm Works

1. **Calculate Daily Needs**: Sum all position vacancies and requested days off
2. **Initial Allocation**: Assign each lifeguard to their preferred position (except on days off)
3. **Handle Overflow**: Manage positions with too many assigned staff
4. **Mandatory Rest Days**: Assign days off when staff exceeds capacity
5. **Final Fill**: Complete remaining positions with secondary preferences

### 📊 Problem Solved

Before this system, scheduling was done manually in spreadsheets, taking hours and prone to human error. This tool automates the entire process in seconds while ensuring fair distribution and covering all positions.

### 🚀 Tech Stack

- **React** for UI components
- **TypeScript** for type safety
- **TailwindCSS** for styling
- **Custom scheduling algorithm** for optimization

### 📝 Current Status

✅ Deployed and in production use  
✅ Active with a local lifeguard team

---

<a name="portugues"></a>
## 🌊 Versão em Português

### 🚀 Demo ao Vivo
🔗 **[Ver App](https://brenobalsini.github.io/BAC-Escalas/)**

### 💻 Visão Geral do Projeto

Sistema automatizado de geração de escalas para equipes de Guarda-Vidas. Criado para substituir planilhas manuais por um algoritmo inteligente que considera preferências, quotas e restrições.

**Construído com:** React • TypeScript • TailwindCSS

### ✨ Funcionalidades Principais

- **Gestão de Efetivo**: Cadastro de Guarda-Vidas com preferências de postos
- **Configuração de Postos**: Definição de posições disponíveis
- **Período da Escala**: Seleção de datas de início e término
- **Algoritmo Inteligente**: Alocação automática baseada em:
  - Preferências de postos
  - Quotas necessárias por posto
  - Folgas obrigatórias
  - Distribuição justa entre todos os postos
- **Histórico de Escalas**: Salvamento e consulta de escalas geradas

### 🧠 Como o Algoritmo Funciona

1. **Cálculo de Necessidades**: Soma das vagas e folgas solicitadas
2. **Alocação Inicial**: Cada GV é alocado na preferência principal (exceto folgas)
3. **Gestão de Superlotação**: Gerencia postos com excesso de pessoal
4. **Folgas Compulsórias**: Atribuição de folgas quando há excedente
5. **Preenchimento Final**: Completa postos restantes com preferências secundárias

### 📊 Problema Resolvido

Antes deste sistema, a escala era feita manualmente em planilhas, levando horas e sujeita a erros. Esta ferramenta automatiza todo o processo em segundos garantindo distribuição justa e cobertura total.

### 🚀 Stack Tecnológica

- **React** para componentes UI
- **TypeScript** para segurança de tipos
- **TailwindCSS** para estilização
- **Algoritmo customizado** para otimização de escalas

### 📝 Status Atual

✅ Implantado e em uso em produção  
✅ Ativo com equipe de Guarda-Vidas local
