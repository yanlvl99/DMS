/**
 @made by yanlvl99
 */

(async () => {
    'use strict';

    // Objeto para centralizar e embelezar os logs no console
    const Logger = {
        _log(style, title, ...args) {
            console.log(`%c${title}`, style, ...args);
        },
        info(...args) {
            this._log('color: #5865F2; font-weight: bold; font-size: 12px;', '[INFO]', ...args);
        },
        success(...args) {
            this._log('color: #57F287; font-weight: bold; font-size: 12px;', '[SUCESSO]', ...args);
        },
        warn(...args) {
            this._log('color: #FEE75C; font-weight: bold; font-size: 12px;', '[AVISO]', ...args);
        },
        error(...args) {
            this._log('color: #ED4245; font-weight: bold; font-size: 12px;', '[ERRO]', ...args);
        },
        progress(...args) {
            this._log('color: #3498DB; font-weight: bold;', '[PROGRESSO]', ...args);
        }
    };

    // --- LÓGICA PRINCIPAL (PILOTO AUTOMÁTICO) ---
    async function run() {
        console.clear();
        Logger.info("Carregando missões...");

        // 1. Carregar módulos essenciais do Discord
        const modules = await loadModules();
        if (!modules) return;

        // 2. Encontrar todas as missões ativas
        const availableQuests = [...modules.QuestsStore.quests.values()].filter(q =>
            q.userStatus?.enrolledAt &&
            !q.userStatus?.completedAt &&
            new Date(q.config.expiresAt).getTime() > Date.now()
        );

        if (availableQuests.length === 0) {
            Logger.warn("Nenhuma missão ativa foi encontrada na sua conta.");
            return;
        }

        // 3. Exibir a fila de missões
        Logger.info(`Encontrada(s) ${availableQuests.length} missão(ões). A ordem de conclusão será:`);
        availableQuests.forEach((quest, index) => {
            console.log(`%c   ${index + 1}. ${quest.config.messages.questName}`, 'color: #B9BBBE; font-style: italic;');
        });
        
        // 4. Executar cada missão em sequência
        for (const quest of availableQuests) {
            await completeQuest(quest, modules);
        }

        Logger.success("Todas as missões disponíveis foram concluídas!");
    }

    async function loadModules() {
        try {
            const wpRequire = window.webpackChunkdiscord_app.push([
                [Symbol()], {}, r => r
            ]).c;
            window.webpackChunkdiscord_app.pop();

            const modules = {
                ApplicationStreamingStore: Object.values(wpRequire).find(x => x?.exports?.Z?.__proto__?.getStreamerActiveStreamMetadata).exports.Z,
                RunningGameStore: Object.values(wpRequire).find(x => x?.exports?.ZP?.getRunningGames).exports.ZP,
                QuestsStore: Object.values(wpRequire).find(x => x?.exports?.Z?.__proto__?.getQuest).exports.Z,
                FluxDispatcher: Object.values(wpRequire).find(x => x?.exports?.Z?.__proto__?.flushWaitQueue).exports.Z,
                api: Object.values(wpRequire).find(x => x?.exports?.tn?.get).exports.tn,
            };

            for (const [name, module] of Object.entries(modules)) {
                if (!module) throw new Error(`Módulo necessário não encontrado: ${name}.`);
            }
            return modules;
        } catch (e) {
            Logger.error("Falha ao buscar módulos do Webpack. O Discord pode ter atualizado.", e);
            return null;
        }
    }

    async function completeQuest(quest, modules) {
        const { config, userStatus } = quest;
        const questName = config.messages.questName;
        const taskConfig = config.taskConfig ?? config.taskConfigV2;
        const taskName = Object.keys(taskConfig.tasks)[0];
        const secondsNeeded = taskConfig.tasks[taskName].target;
        const secondsDone = userStatus?.progress?.[taskName]?.value ?? 0;
        
        const isDesktopApp = typeof window.DiscordNative !== "undefined";

        switch (taskName) {
            case "WATCH_VIDEO":
            case "WATCH_VIDEO_ON_MOBILE":
                await handleWatchVideo(quest, modules, secondsNeeded, secondsDone);
                break;

            case "PLAY_ON_DESKTOP":
            case "STREAM_ON_DESKTOP":
                if (!isDesktopApp) {
                    Logger.error(`Esta missão requer o aplicativo Discord para desktop. Pulando para a próxima.`);
                    return;
                }
                if (taskName === "PLAY_ON_DESKTOP") {
                    await handlePlayOnDesktop(quest, modules, secondsNeeded, secondsDone);
                } else {
                    await handleStreamOnDesktop(quest, modules, secondsNeeded, secondsDone);
                }
                break;
            
            default:
                Logger.error(`Tipo de tarefa não suportado: ${taskName}. Pulando para a próxima.`);
                break;
        }
    }

    // --- MANIPULADORES DE TAREFAS ---

    async function handleWatchVideo(quest, modules, secondsNeeded, secondsDone) {
        const { id: questId, userStatus, config } = quest;
        const questName = config.messages.questName;
        let currentProgress = secondsDone;
        const enrolledAt = new Date(userStatus.enrolledAt).getTime();
        const totalMinutes = Math.ceil(secondsNeeded / 60);

        let lastLoggedMinute = Math.floor(currentProgress / 60);
        Logger.progress(`${questName}: ${lastLoggedMinute}/${totalMinutes} min`);

        while (currentProgress < secondsNeeded) {
            // Lógica de segurança para evitar loops infinitos se o progresso travar
            let progressMadeInStep = false;

            // Define um teto de progresso para não ser pego pelo anti-cheat
            const maxFutureAllowance = 15; // segundos
            const maxAllowedProgress = Math.floor((Date.now() - enrolledAt) / 1000) + maxFutureAllowance;

            // Define o quanto queremos progredir
            const progressStep = 20; // segundos
            let newProgress = currentProgress + progressStep;

            // Garante que o novo progresso seja válido
            newProgress = Math.min(newProgress, maxAllowedProgress, secondsNeeded);

            if (newProgress > currentProgress) {
                try {
                    const timestamp = newProgress + Math.random();
                    const res = await modules.api.post({ url: `/quests/${questId}/video-progress`, body: { timestamp } });
                    
                    currentProgress = res.body.completed_at ? secondsNeeded : newProgress;
                    progressMadeInStep = true;
                } catch (e) { /* Falha na API, tenta novamente no próximo ciclo */ }
            }

            const currentMinute = Math.floor(currentProgress / 60);
            if (currentMinute > lastLoggedMinute) {
                lastLoggedMinute = currentMinute;
                Logger.progress(`${questName}: ${currentMinute}/${totalMinutes} min`);
            }
            
            // Espera antes da próxima tentativa
            await new Promise(resolve => setTimeout(resolve, progressMadeInStep ? 5000 : 10000)); // Espera 5s se progrediu, 10s se não
        }
        Logger.success(`${questName}: Missao Completa!`);
    }

    function handleGenericDesktopTask(quest, modules, secondsNeeded, secondsDone, taskType) {
        return new Promise(async (resolve, reject) => {
            // CORREÇÃO: Desestruturar os módulos aqui para que fiquem disponíveis no escopo da função.
            const { RunningGameStore, ApplicationStreamingStore, FluxDispatcher, api } = modules;
            const { application, messages } = quest.config;
            const questName = messages.questName;
            
            let fakeGame;

            try {
                const pid = Math.floor(Math.random() * 30000) + 1000;
                let originalGetRunningGames, originalGetGameForPID, originalGetMetadata;
                const realGames = RunningGameStore.getRunningGames();

                if (taskType === "PLAY_ON_DESKTOP") {
                    const res = await api.get({ url: `/applications/public?application_ids=${application.id}` });
                    const exeName = res.body[0]?.executables?.find(e => e.os === "win32")?.name.replace(">", "");
                    if (!exeName) throw new Error("Executável não encontrado.");
                    
                    fakeGame = {
                        id: application.id, pid, name: application.name, exeName,
                        cmdLine: `C:\\Program Files\\${application.name}\\${exeName}`,
                        exePath: `c:/program files/${application.name.toLowerCase()}/${exeName}`,
                        hidden: false, isLauncher: false, pidPath: [pid],
                        processName: application.name, start: Date.now(),
                    };
                    
                    const fakeGames = [fakeGame];
                    originalGetRunningGames = RunningGameStore.getRunningGames;
                    originalGetGameForPID = RunningGameStore.getGameForPID;
                    RunningGameStore.getRunningGames = () => fakeGames;
                    RunningGameStore.getGameForPID = (p) => fakeGames.find(g => g.pid === p);
                    FluxDispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", added: fakeGames, games: fakeGames, removed: realGames });

                } else { // STREAM_ON_DESKTOP
                    originalGetMetadata = ApplicationStreamingStore.getStreamerActiveStreamMetadata;
                    ApplicationStreamingStore.getStreamerActiveStreamMetadata = () => ({ id: application.id, pid });
                }
                
                const totalMinutes = Math.ceil(secondsNeeded / 60);
                let lastLoggedMinute = Math.floor(secondsDone / 60);
                Logger.progress(`${questName}: ${lastLoggedMinute}/${totalMinutes} min`);

                const onHeartbeat = (data) => {
                    if (data.questId !== quest.id) return;
                    const progress = Math.floor(data.userStatus.progress[taskType].value);
                    const currentMinute = Math.floor(progress / 60);

                    if (currentMinute > lastLoggedMinute) {
                        lastLoggedMinute = currentMinute;
                        Logger.progress(`${questName}: ${currentMinute}/${totalMinutes} min`);
                    }

                    if (progress >= secondsNeeded) {
                        FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", onHeartbeat);

                        if (taskType === "PLAY_ON_DESKTOP") {
                            RunningGameStore.getRunningGames = originalGetRunningGames;
                            RunningGameStore.getGameForPID = originalGetGameForPID;
                            FluxDispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", removed: [fakeGame], games: realGames, added: [] });
                        } else {
                            ApplicationStreamingStore.getStreamerActiveStreamMetadata = originalGetMetadata;
                        }
                        
                        Logger.success(`${questName}: Missao Completa!`);
                        resolve();
                    }
                };

                FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", onHeartbeat);

            } catch (e) {
                Logger.error(`Falha ao preparar a missão:`, e);
                reject(e);
            }
        });
    }

    async function handlePlayOnDesktop(quest, modules, secondsNeeded, secondsDone) {
        return handleGenericDesktopTask(quest, modules, secondsNeeded, secondsDone, "PLAY_ON_DESKTOP");
    }

    async function handleStreamOnDesktop(quest, modules, secondsNeeded, secondsDone) {
        Logger.warn(`AÇÃO NECESSÁRIA PARA A MISSÃO "${quest.config.messages.questName}":`);
        console.log("%c   1. Entre em um canal de voz.", 'color: #FEE75C;');
        console.log("%c   2. Comece a transmitir QUALQUER TELA ou APLICATIVO.", 'color: #FEE75C;');
        console.log("%c   (O progresso começará assim que você iniciar a transmissão)", 'color: #B9BBBE; font-style: italic;');
        return handleGenericDesktopTask(quest, modules, secondsNeeded, secondsDone, "STREAM_ON_DESKTOP");
    }

    // Inicia a execução do script
    run();

})();


