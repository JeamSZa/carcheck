# CarCheck

O CarCheck é uma aplicação web para organizar informações de veículos e acompanhar manutenções. A pessoa usuária pode criar uma conta, cadastrar seus veículos, manter a quilometragem atualizada, consultar o histórico de serviços e receber alertas relacionados à troca de óleo.

O projeto foi desenvolvido como aplicação acadêmica, com uma interface responsiva e uma API própria para persistir os dados localmente em SQLite.

> **Importante:** este projeto ainda não é adequado para uso em produção. Não use senhas reais nem cadastre dados pessoais ou informações sensíveis.

## Sumário

- [O que o projeto faz](#o-que-o-projeto-faz)
- [Telas e fluxos](#telas-e-fluxos)
- [Regras de negócio](#regras-de-negócio)
- [Tecnologias e integrações](#tecnologias-e-integrações)
- [Organização dos arquivos](#organização-dos-arquivos)
- [Como executar localmente](#como-executar-localmente)
- [Como testar manualmente](#como-testar-manualmente)
- [API](#api)
- [Modelo de dados](#modelo-de-dados)
- [Limitações conhecidas e segurança](#limitações-conhecidas-e-segurança)
- [Licença](#licença)

## O que o projeto faz

O CarCheck reúne dados básicos sobre a conta, os veículos e os serviços realizados:

- Cria uma conta com nome, e-mail e senha e permite entrar e sair da aplicação.
- Cadastra veículos com marca, modelo, ano, placa e quilometragem atual.
- Consulta marcas, modelos e anos pela API FIPE durante o cadastro. Se a consulta não estiver disponível, o formulário permite informar esses dados manualmente.
- Exibe o status e a quilometragem de cada veículo.
- Permite atualizar a quilometragem, impedindo que o novo valor seja inferior ao valor atual.
- Registra serviços com data, quilometragem, valor e descrição opcional.
- Apresenta o histórico de serviços e os gastos registrados.
- Calcula alertas de troca de óleo com base na quilometragem atual e na última manutenção cujo título mencione óleo.
- Permite excluir manutenções e veículos. Excluir um veículo também exclui o histórico de manutenções associado a ele.

## Telas e fluxos

### Entrar e criar conta

A tela inicial oferece formulários para entrar ou criar uma conta. Após o cadastro ou login, os dados básicos da conta ficam na sessão do navegador para manter a pessoa conectada durante o uso. A tela de Configurações mostra nome e e-mail e oferece a ação de sair.

### Visão geral

O dashboard resume:

- Quantidade de veículos cadastrados.
- Quantos veículos estão em dia.
- Quantos precisam de atenção ou estão com manutenção atrasada.
- Gastos registrados nos últimos 30 dias.
- Cartões dos veículos e alertas prioritários.

### Garagem

A garagem lista os veículos cadastrados. É possível buscar por marca, modelo ou placa e filtrar os resultados por status. Selecionar um cartão abre os detalhes daquele veículo.

### Detalhes do veículo

Esta tela mostra os dados do veículo, a quilometragem atual, o status da troca de óleo e o histórico de serviços. Nela também é possível atualizar a quilometragem, registrar um serviço, excluir uma manutenção ou excluir o veículo.

### Manutenções

A tela de Manutenções apresenta os serviços registrados e filtros para visualizar todas as entradas, as realizadas e o acompanhamento de trocas de óleo próximas ou atrasadas. Os valores informados nos serviços são usados no cálculo de gastos do dashboard.

### Alertas

A tela de Alertas detalha os veículos que precisam de atenção, incluindo a mensagem correspondente e, quando há uma troca de óleo registrada, informações de quilometragem para contextualizar o alerta.

### Configurações

A tela exibe o nome e o e-mail associados à sessão atual e permite sair da conta. A edição do perfil não está disponível nesta versão.

### Navegação e layout

A aplicação funciona como uma SPA (Single-Page Application): as telas são alternadas por rotas com hash, como `#/dashboard`, `#/garagem` e `#/alertas`, sem recarregar a página inteira. Em telas grandes há navegação lateral; em telas menores, a navegação se adapta a um menu e uma barra inferior.

## Regras de negócio

### Alertas de troca de óleo

O sistema procura, no histórico do veículo, a manutenção com maior quilometragem cujo título contenha “oleo”. A comparação não diferencia maiúsculas de minúsculas nem acentos, então títulos como `Troca de óleo`, `Troca de Oleo` e `TROCA DE ÓLEO` são reconhecidos.

Se `quilometragem atual - quilometragem da última troca` resultar em:

| Distância desde a troca | Status |
| --- | --- |
| Menos de 8.000 km | Em dia |
| De 8.000 km até menos de 10.000 km | Atenção |
| 10.000 km ou mais | Atrasada |
| Não existe troca de óleo registrada | Informativo |

O alerta é calculado com base na quilometragem informada. O sistema não estima a quilometragem futura nem cria lembretes por data.

### Gastos

O total do dashboard soma os valores das manutenções cuja data esteja dentro dos últimos 30 dias. Serviços sem valor informado no cadastro são gravados com valor zero.

### Validações numéricas

A API rejeita quilometragem, valor e ano negativos quando esses campos são enviados. A quilometragem não pode ser reduzida ao atualizar um veículo pela interface.

## Tecnologias e integrações

- **Frontend:** HTML, CSS e JavaScript.
- **Interface:** Bootstrap 5.3.3 e Bootstrap Icons, carregados por CDN.
- **Fontes:** Inter e Manrope, carregadas pelo Google Fonts.
- **Backend:** Node.js com Express.
- **Persistência:** SQLite, acessado pela biblioteca `better-sqlite3`.
- **Consulta de veículos:** API FIPE, acessada pelo navegador.

É necessária conexão com a internet para carregar os recursos externos (Bootstrap, ícones e fontes) e para consultar a FIPE. Se a FIPE falhar ou estiver indisponível, o cadastro de veículo oferece preenchimento manual.

## Organização dos arquivos

```text
CarCheck/
├── backend/
│   ├── database.js       # Abre o SQLite e cria as tabelas se necessário
│   ├── server.js         # API Express e servidor dos arquivos do frontend
│   ├── package.json      # Dependências e comandos npm
│   ├── package-lock.json # Versões resolvidas das dependências
│   └── carcheck.db       # Banco local criado durante a execução; não publicar
├── frontend/
│   ├── index.html        # Estrutura da SPA, navegação e formulários
│   ├── app.js            # Sessão, chamadas à API, regras e renderização das telas
│   └── styles.css        # Tema visual e regras responsivas
├── .gitignore
└── README.md
```

O banco é aberto em `backend/carcheck.db`. Essa é uma base local de desenvolvimento, não um serviço de banco de dados remoto. Não envie o arquivo `.db` ao repositório, pois ele pode conter dados cadastrados durante os testes.

## Como executar localmente

### Requisitos

- Node.js instalado.
- npm (incluído com o Node.js).
- Navegador atualizado.
- Conexão com a internet para os recursos externos e a FIPE.

### Instalação e inicialização

No PowerShell, a partir da pasta raiz do projeto:

```powershell
cd backend
npm install
npm start
```

Quando o terminal mostrar que o servidor está rodando na porta `3000`, abra:

```text
http://localhost:3000
```

Para encerrar, volte ao terminal do servidor e pressione `Ctrl+C`.

O backend também possui o comando de desenvolvimento:

```powershell
npm run dev
```

Esse comando reinicia o servidor quando arquivos do backend são alterados.

## Como testar manualmente

1. Inicie o servidor e abra `http://localhost:3000`.
2. Crie uma conta de teste usando um e-mail fictício e uma senha que não use em outros serviços.
3. Na visão geral ou na garagem, escolha **Adicionar veículo**.
4. Selecione marca, modelo e ano na FIPE ou use os campos manuais caso a consulta não esteja disponível. Preencha placa e quilometragem.
5. Abra os detalhes do veículo e registre uma manutenção com o título **Troca de óleo e filtro**.
6. Atualize a quilometragem do veículo e confira o status:
   - 8.000 km acima da quilometragem da troca: **Atenção**.
   - 10.000 km ou mais acima: **Atrasada**.
   - Sem troca de óleo no histórico: **Informativo**.
7. Confira o histórico, os gastos no dashboard e a tela de Alertas.
8. Teste a busca e o filtro de status na garagem, além dos filtros da tela de Manutenções.
9. Teste excluir uma manutenção e, se apropriado, o veículo de teste.
10. Saia da conta e encerre o servidor com `Ctrl+C`.

As alterações feitas durante o teste são gravadas no banco local `backend/carcheck.db`. Use dados fictícios e não publique esse arquivo.

## API

A API é servida pelo mesmo processo Express que entrega os arquivos do frontend. As rotas disponíveis nesta versão são:

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/usuarios` | Cria uma conta. |
| `POST` | `/login` | Valida e-mail e senha e retorna os dados básicos da conta. |
| `GET` | `/veiculos/:usuario_id` | Lista os veículos de uma conta. |
| `POST` | `/veiculos` | Cadastra um veículo. |
| `PUT` | `/veiculos/:id` | Atualiza os dados de um veículo, incluindo quilometragem. |
| `DELETE` | `/veiculos/:id` | Exclui o veículo e suas manutenções. |
| `GET` | `/manutencoes/usuario/:usuario_id` | Lista as manutenções dos veículos de uma conta. |
| `GET` | `/manutencoes/:veiculo_id` | Lista o histórico de um veículo. |
| `POST` | `/manutencoes` | Registra uma manutenção. |
| `DELETE` | `/manutencoes/:id` | Exclui uma manutenção. |
| `GET` | `/alertas/:usuario_id` | Calcula alertas de manutenção para os veículos da conta. |

Erros de validação da API são retornados como JSON no formato `{ "erro": "mensagem" }`, acompanhados de um código HTTP de erro.

## Modelo de dados

O SQLite contém três tabelas:

- **`usuario`**: identificador, nome, e-mail e senha.
- **`veiculo`**: identificador da conta proprietária, marca, modelo, ano, placa e quilometragem.
- **`manutencao`**: identificador do veículo, título do serviço, descrição, data, quilometragem realizada e valor.

As tabelas são criadas automaticamente pelo backend na primeira inicialização, caso ainda não existam.

## Limitações conhecidas e segurança

- O projeto foi criado para estudo e execução local, não para armazenar dados reais.
- As senhas são armazenadas sem hash no banco. Não use senhas reais ou reutilizadas.
- A sessão é mantida no armazenamento da sessão do navegador; esta versão não implementa autenticação robusta com tokens, autorização de produção ou recuperação de senha.
- As configurações de CORS e de servidor não foram preparadas para uma implantação pública segura.
- A tela de perfil é somente de leitura.
- As previsões de manutenção se limitam à regra de troca de óleo descrita acima; não há integração com oficinas, calendário ou notificações externas.
- O repositório não possui uma suíte automatizada de testes configurada. A seção de teste descreve verificações manuais.

Antes de hospedar publicamente, implemente hash seguro de senhas, autenticação e autorização adequadas, validação reforçada dos dados, configuração de produção e uma política de backup e proteção do banco.

## Licença

Nenhuma licença foi definida neste projeto até o momento. Se quiser permitir que outras pessoas usem, modifiquem ou distribuam o código, escolha uma licença e adicione o arquivo correspondente (por exemplo, `LICENSE`).
