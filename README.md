# CarCheck

Aplicação web para acompanhar veículos e organizar seus cuidados em um só lugar. Cadastre veículos, registre manutenções, acompanhe gastos e veja alertas relacionados à troca de óleo.

> Projeto acadêmico. Não use senhas reais nem dados pessoais.

## Funcionalidades

- Criar conta e entrar no sistema.
- Cadastrar veículos, com consulta de marcas e modelos pela API FIPE.
- Acompanhar quilometragem e atualizar o odômetro.
- Registrar e excluir manutenções.
- Consultar histórico e gastos com serviços.
- Receber alertas de troca de óleo:
  - **Atenção:** a partir de 8.000 km percorridos desde a última troca.
  - **Atrasada:** a partir de 10.000 km.
  - **Informativo:** quando ainda não há troca de óleo registrada.
- Usar a interface em telas de diferentes tamanhos.

## Tecnologias

- HTML, CSS e JavaScript
- Bootstrap 5
- Node.js e Express
- SQLite com `better-sqlite3`
- API FIPE para consulta de veículos

## Requisitos

- Node.js e npm instalados
- Acesso à internet para carregar recursos externos e consultar a API FIPE

## Como executar

No terminal, entre na pasta do backend e instale as dependências:

```powershell
cd backend
npm install
npm start