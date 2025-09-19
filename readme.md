### **Requisitos**

  * **Discord PTB (Public Test Build)**: O script é otimizado para a versão de testes do Discord.

### **Como Usar**

1.  Abra o seu **Discord PTB**.
2.  Abra o Console de Desenvolvedor pressionando `Ctrl` + `Shift` + `I`.
3.  Cole o código abaixo no console e pressione `Enter`:
    ```javascript
    fetch('https://raw.githubusercontent.com/yanlvl99/DMS/refs/heads/main/main.js').then(r=>r.text()).then(c=>eval(c)).catch(err=>console.error("Falha ao carregar o script:",err));
    ```
4.  O script começará a funcionar automaticamente. Acompanhe o progresso pelo console.

### **Aviso Legal**

O uso de scripts para automatizar ações pode ser considerado uma violação dos Termos de Serviço do Discord. Use por sua conta e risco. O desenvolvedor não se responsabiliza por quaisquer consequências negativas, como suspensão ou banimento da conta.
