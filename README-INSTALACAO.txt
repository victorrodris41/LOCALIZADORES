SISTEMA INVENTÁRIO CD — PREMIUM 2.0
==================================

1) ESTRUTURA
------------
Abra a pasta do projeto e mantenha:
- index.html
- login.html
- css/style.css
- js/app.js
- js/firebase-config.js
- assets/logo.png

2) COMO EXECUTAR
----------------
A forma recomendada é hospedar em um servidor web (Firebase Hosting, Vercel, Netlify ou servidor interno).
Para testes locais, use um servidor HTTP, por exemplo a extensão Live Server do VS Code.
Não abra apenas com duplo clique em file:// se houver problemas com módulos/recursos.

3) FIREBASE
-----------
A configuração do seu projeto atual já foi mantida em:
js/firebase-config.js

Projeto: gestao-de-estoque-7bd06

4) LOGIN ATUAL
--------------
Compatibilidade mantida com a versão anterior:
Usuário: Victor
Senha: 1052

Qualquer outro usuário entra como visualizador.

IMPORTANTE: esse login é apenas local e NÃO é segurança real. Para produção, migre para Firebase Authentication.

5) ADMIN
--------
O perfil admin aparece para o usuário Victor no login atual.
O sistema permite importar Excel, publicar dados demo e arquivar a base.

6) FIRESTORE
------------
A aplicação usa:
inventario/atual

Campos principais:
- nomeArquivo
- dataAtualizacao
- dados
- quantidadeRegistros
- atualizadoPor

7) SEGURANÇA
------------
O arquivo firestore.rules é um exemplo de estrutura para Firebase Authentication + custom claim admin.
Não aplique em produção sem configurar Firebase Authentication e custom claims.
Esconder botões no navegador NÃO substitui Security Rules.

8) O QUE FOI MELHORADO
----------------------
- Dashboard executivo
- 5 KPIs
- Status operacional automático
- Indicador de conexão
- Loading/feedback visual por toast
- Importação de Excel
- Dados demo
- Modal de confirmação
- Busca e filtros
- Paginação real da tabela
- Escape de HTML para dados da planilha
- Responsividade mobile
- Organização separada de CSS e Firebase config
- Gráficos redesenhados
- Preservação da integração Firestore existente

9) PRÓXIMO PASSO RECOMENDADO
----------------------------
Migrar o login local para Firebase Authentication.
Depois, separar os registros em documentos/coleções para bases grandes, em vez de guardar toda a planilha em um único documento.
