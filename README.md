# Rain Machine

Projeto Unity 6 (URP) da máquina **Rain Machine**, com viewer web interativo publicado no GitHub Pages.

## Viewer web (GitHub Pages)

**URL:** [https://jpeixer.github.io/Rain-machine/](https://jpeixer.github.io/Rain-machine/)

No celular ou desktop você pode:

- Girar e dar zoom no modelo 3D (toque + pinça)
- Tocar em peças para abrir a ficha estilo BOM (lista de materiais)
- Reproduzir animações exportadas da Unity
- **Ligar/Desligar** o sistema ao clicar no botão "Liga/Desliga" — ativa o jato de água nos bicos (nozzle) com animação de partículas
- **Regular intensidade** ao clicar nas Válvulas — botões + e − controlam a potência do jato (10% a 100%)

### Publicar / atualizar o site

1. Na Unity: **Rain Machine → Export for Web** (gera `docs/assets/machine.glb` e JSON em `docs/data/`).
2. Commit e push da pasta `docs/` para o branch `main`.
3. No GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch `main` → Folder `/docs`**.

### Testar localmente

```bash
npx --yes serve docs
```

Abra o endereço indicado (ex.: `http://localhost:3000`) no navegador ou no celular na mesma rede.

---

## Unity — fluxo de trabalho

### Requisitos

- Unity **6000.0.41f1** (ou compatível com o projeto)
- Pacote **glTFast** (`com.unity.cloud.gltfast`) — já no `Packages/manifest.json`

### Hierarquia recomendada

```
RainMachine (RainMachineRoot + Animator)
├── Structure/     # peças fixas
├── Mechanisms/    # partes móveis
└── Hotspots/      # esferas grandes para toque fácil (opcional)
```

Cada peça clicável deve ter o componente **`PartInfo`** (ID, nome, descrição, categoria, quantidade).

### Menus do editor

| Menu | Função |
|------|--------|
| **Rain Machine → Setup Demo Scene** | Cria cena demo com primitivas, PartInfo e animações de exemplo |
| **Rain Machine → Export for Web** | Exporta GLB + `parts.json` + `viewer-config.json` para `docs/` |

### Animações

Use **Animator Controller** com clips nomeados de forma estável (ex.: `OpenValve`, `CycleRain`). Os nomes aparecem na barra inferior do site após o export.

### Performance (mobile)

- Alvo: < 80k triângulos, texturas até 1024px
- Materiais URP Lit simples
- Reexporte após mudanças grandes no modelo

---

## Estrutura do repositório

```
Assets/Scripts/Viewer/     # PartInfo, RainMachineRoot, export Editor
docs/                      # Site GitHub Pages (HTML + Three.js + GLB)
Packages/manifest.json     # Dependências Unity (URP, glTFast, MCP)
```

---

## Integração Cursor + Unity MCP

O pacote **MCP for Unity** permite ao Cursor inspecionar a cena, compilar scripts e executar menus a partir do chat.

---

## Licença

Projeto pessoal / em desenvolvimento.
