# Sistema de Pedidos Online — Supermercado Schwambach

Sistema estático, mobile first, criado em HTML5, CSS3 e JavaScript Vanilla.
O cliente preenche o pedido e, ao finalizar, o WhatsApp é aberto com todos os dados formatados para a recepção.

## WhatsApp configurado

- Número informado: (27) 99822-5807
- Link interno usado pelo sistema: 5527998225807

Para trocar o número futuramente, abra `assets/js/script.js` e altere:

```js
const WHATSAPP_NUMBER = '5527998225807';
```

## Como testar

Opção mais simples:
1. Extraia o ZIP.
2. Abra `index.html` no navegador.
3. Preencha os campos.
4. Clique em `Conferir pedido`.
5. Clique em `Enviar no WhatsApp`.

Para testar como site local, você também pode executar na pasta:

```bash
python -m http.server 8000
```

Depois acesse `http://localhost:8000`.

## Estrutura

- `index.html` — interface principal
- `assets/css/style.css` — design e responsividade
- `assets/js/script.js` — itens dinâmicos, validação, rascunho e WhatsApp
- `assets/images/logo-schwambach.webp` — logo otimizada para web
- `assets/images/favicon.png` — ícone do site
- `manifest.webmanifest` — configuração de instalação/PWA básica
- `robots.txt` — configuração de rastreamento

## Recursos incluídos

- Dados do cliente
- Endereço completo e referência
- Itens dinâmicos (até 40)
- Quantidade e observação por item
- Autorização/consulta para substituições
- Formas de pagamento: dinheiro, débito, crédito e PIX
- Campo de troco quando o pagamento é dinheiro
- Solicitação de nota fiscal
- CPF/CNPJ e nome/razão social opcionais
- Observações gerais
- Validação de campos obrigatórios
- Tela de conferência antes do envio
- Mensagem formatada para WhatsApp
- Botão para copiar o resumo
- Rascunho automático via LocalStorage
- Layout responsivo para celular, tablet e desktop
- Acessibilidade básica e foco por teclado

## Publicação

O projeto pode ser publicado sem backend em:
- Vercel
- Netlify
- Cloudflare Pages
- GitHub Pages
- hospedagem convencional

Basta enviar a pasta mantendo `index.html` na raiz.

## Observação importante

Este MVP não armazena pedidos em banco de dados. Os dados ficam no aparelho do cliente apenas como rascunho local e são enviados ao WhatsApp quando o cliente decide concluir.

Antes de usar oficialmente, valide com a gerência os textos, a área de entrega, as regras de substituição, nota fiscal e política de atendimento.
