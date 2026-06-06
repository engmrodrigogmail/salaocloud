---
name: Escopo do Desconto Manual na Comissão
description: Como a função recalculate_tab_commissions distribui desconto manual entre as bases de comissão dos itens
type: feature
---

Regras de distribuição do desconto manual sobre a base de comissão (função `public.recalculate_tab_commissions`):

1. **Desconto manual com `manual_discount_item_amounts` (valores por item):** subtrai exatamente o valor informado por item. Itens fora do map mantêm base cheia.
2. **Desconto manual com `manual_discount_item_ids` (lista de itens):** apenas os itens marcados têm a base reduzida (rateio proporcional dentro desse subset).
3. **Desconto manual SEM itens marcados nem valores por item → WATERFALL:** o desconto é absorvido começando pelo item de maior `total_price` (desempate por `created_at`), até o desconto se esgotar. Itens menores ficam com a base original. Protege o profissional dos serviços de comissão alta e bate com a expectativa do salão (ex: desconto de R$ 80 numa comanda de R$ 420 com Mechas 300 50%, Coloração 80 50%, Mão 40 70% → comissão R$ 178,00, não R$ 176,48 do rateio proporcional).
4. **Cupom:** mantém rateio proporcional dentro do escopo do cupom (`discount_target` = total/services/products), respeitando `commission_discount_on_coupon`.
5. **Fidelidade:** rateio proporcional, respeitando `commission_discount_on_loyalty`.

Reconciliação de centavos: após calcular cada comissão arredondada a 2 casas, há uma etapa que compara `round(sum(raw),2)` vs `sum(round(raw,2))` por (profissional, regra) e aplica o `diff` no item de maior valor para garantir soma exata.
