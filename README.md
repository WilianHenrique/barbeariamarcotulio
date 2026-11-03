# Remix of Barbershop Sync

Preciso que você crie um sistema para uma Barbearia, o sistema é responsável pelas notificações dos agendamentos realizados.

Os agendamentos são feitos atravéz do google calendário, toda vez que é feito um agendamento, alteração ou cancelamento é recebido o evento atravéz do N8N, e por lá ele irá disparar um Webhook aqui para este sistema contendo as informações do agendamento.

Segue um exemplo de como será enviado aqui para você quando for feito um agendamento:
[
  {
    "id_evento": "6vdhs47ekfvib72beglhlib0on",
    "Nome_cliente": "test do wilian 233",
    "dateTime-start": "2025-11-11T13:30:00-03:00",
    "dateTime-end": "2025-11-11T14:30:00-03:00",
    "Dia_agendado_formatado": "11/11/2025",
    "Dia_agendado": "2025-11-04",
    "Hora_agendada": "13:30",
    "Hora_final": "14:30",
    "Link_evento": "https://www.google.com/calendar/event?eid=NnZkaHM0N2VrZnZpYjcyYmVnbGhsaWIwb25fMjAyNTExMTFUMTYzMDAwWiB3aWxpYW5tbDg4MjJAbQ",
    "servico": "cabelo + barba",
    "tempo_total_minutos": "60",
    "Status_Evento": "Evento criado"
    "EventoRecorrente": "Não"
  }
]

Com isso, você deve criar um banco de dados que irá armazenar os agendamentos que estão sendo realizados.

Este sistema será responsável por disparar 2 webhooks para o endpoint: https://automacoes.federalassociadoscadastro.com/webhook/agendamentos_marco_tulio contendo todas as informações do usuário enviadas anteriormente porém vendo qual seria a notificação. Quando faltar 24 horas para o evento envie: "Notificação de 24 horas" ou se caso faltar 1 hora para o evento envie "Notificação de 1 hora".

Ou seja, o sistema com base no horário do evento fará esse disparo 24 horas antes ou 1 hora antes.

Crie um sistema com login e senha para que outras pessoas não possam ter acesso.

Crie um visual de barbearia e mostrando as tabelas dos agendados e quanto tempo falta para enviar a mensagem de notificação.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://barbeariamarcotulio.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/baac2b9f-a38d-4c6a-942e-5599280952fe).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
