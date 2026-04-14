# 🤖 Qwen AE Companion

Extension para Adobe After Effects que integra o **Qwen AI** para controle total da aplicação via chat.

## ✨ Funcionalidades

Com este companion, você pode solicitar ao Qwen que:

- ✅ **Criar composições** com qualquer configuração
- ✅ **Adicionar camadas** (texto, sólidos, formas, lights, cameras)
- ✅ **Aplicar efeitos** de qualquer tipo
- ✅ **Criar e editar keyframes** para animações
- ✅ **Modificar propriedades** (posição, escala, rotação, opacidade, etc.)
- ✅ **Acessar e modificar qualquer propriedade** do projeto
- ✅ **Executar tarefas complexas** de automação

## 📁 Estrutura do Projeto

```
qwen-ae-companion/
├── CSXS/
│   └── manifest.xml          # Configuração da extensão CEP
├── client/
│   ├── index.html            # Interface do painel (chat + lógica)
│   ├── CSInterface.js        # Biblioteca Adobe CEP
│   └── extendscript.js       # Funções ExtendScript opcionais
└── package.json
```

## 🚀 Instalação

### Passo 1: Habilitar Extensões Não Assinadas

**Windows:**
1. Feche o After Effects
2. Abra o Registry Editor (`regedit`)
3. Navegue até: `HKEY_CURRENT_USER\SOFTWARE\Adobe\CSXS.10` (ou versão correspondente)
4. Crie uma nova chave String chamada `PlayerDebugMode` com valor `1`

**Mac:**
1. Feche o After Effects
2. Abra o Terminal
3. Execute:
```bash
defaults write com.adobe.CSXS.10 PlayerDebugMode 1
```

### Passo 2: Instalar a Extensão

1. Copie a pasta `qwen-ae-companion` para:
   - **Windows:** `C:\Users\<SEU_USUARIO>\AppData\Roaming\Adobe\CEP\extensions\`
   - **Mac:** `/Users/<SEU_USUARIO>/Library/Application Support/Adobe/CEP/extensions/`

2. Inicie o After Effects

3. Vá em `Window > Extensions > Qwen AE Companion`

## 🎯 Como Usar

1. **Obtenha sua API Key do Qwen** no [DashScope Console](https://dashscope.console.aliyun.com/)

2. **Cole sua API Key** no campo indicado no painel

3. **Descreva o que quer criar**, por exemplo:
   - "Crie uma composição 1920x1080 com um texto animado entrando da esquerda"
   - "Adicione um efeito de blur gaussiano na camada selecionada e anime de 0 a 50"
   - "Crie 5 camadas de sólido com cores diferentes e distribua no tempo"
   - "Anime a posição de uma camada criando um movimento de quicada"

4. **Clique em "Enviar"** e aguarde o Qwen gerar o código

5. **Clique em "Executar no After Effects"** para aplicar as mudanças

## ⚠️ Importante

- Esta extensão dá **CONTROLE TOTAL** sobre seu After Effects
- O Qwen pode executar qualquer operação via ExtendScript
- Sempre revise o código gerado antes de executar se estiver inseguro
- Faça backup dos seus projetos importantes

## 🔧 Desenvolvimento

Para testar alterações durante o desenvolvimento, você pode usar ferramentas como:

- [zxp-sign-cmd](https://github.com/zdennis/zxp-sign-cmd) para assinar extensões
- [cep-testing](https://github.com/Adobe-CEP/cep-testing) para testes automatizados

## 📝 Exemplos de Comandos

```
"Crie uma composição com 3 camadas de texto fazendo fade in sequencial"

"Adicione um efeito CC Sphere na camada ativa e anime a rotação"

"Crie um padrão de partículas usando expressões"

"Anime a escala de 0% a 100% com easing ease out"

"Crie uma transição de wipe entre duas composições"
```

## 🛠️ Tecnologias

- **CEP (Common Extensibility Platform)** - Framework de extensões Adobe
- **ExtendScript** - JavaScript do After Effects
- **Qwen API** - IA para geração de código
- **HTML/CSS/JS** - Interface do painel

## 📄 Licença

MIT

---

**Desenvolvido para dar poder total de criação ao usuário através de IA! 🚀**
