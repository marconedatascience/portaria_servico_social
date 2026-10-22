"O teste de emissão do QR Code e o bloqueio de cota funcionaram perfeitamente. Agora, vamos implementar o módulo de 'Troca de Acompanhante'. Cria o componente visual necessário para a portaria realizar esta troca e conecta-o à base de dados. Lembra-te destas regras de negócio para a troca:
- O paciente pode ter no máximo 1 acompanhante ativo.
- A troca só é permitida nestas janelas de horário: 07:30-08:30 e 18:30-19:30.
- O fluxo deve ser atómico via RPC: o sistema revoga a credencial do acompanhante antigo e emite a credencial com Payload cego para o novo acompanhante na mesma transação."