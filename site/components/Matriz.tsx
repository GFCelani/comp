export function Matriz({
  rotulos,
  valores,
  legenda,
  eixoLinha = "previsto",
  eixoColuna = "realizado",
}: {
  rotulos: string[];
  valores: number[][];
  legenda: string;
  eixoLinha?: string;
  eixoColuna?: string;
}) {
  const max = Math.max(1, ...valores.flat());
  return (
    <div className="overflow-x-auto">
      <table className="num text-sm border-separate border-spacing-1" aria-label={legenda}>
        <caption className="sr-only">{legenda}</caption>
        <thead>
          <tr>
            <th scope="col" className="text-left text-xs text-texto-2 font-normal pr-2 align-bottom">
              {eixoLinha} ↓ / {eixoColuna} →
            </th>
            {rotulos.map((r) => (
              <th key={r} scope="col" className="text-xs text-texto-2 font-normal px-1 pb-1 align-bottom">
                {r}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {valores.map((linha, i) => (
            <tr key={rotulos[i] ?? i}>
              <th scope="row" className="text-left text-xs text-texto-2 font-normal pr-2 whitespace-nowrap">
                {rotulos[i]}
              </th>
              {linha.map((v, j) => {
                const diagonal = i === j;
                const alpha = v === 0 ? 0 : 0.15 + 0.6 * (v / max);
                return (
                  <td
                    key={j}
                    className={`text-center rounded min-w-[3rem] px-2 py-2 border ${
                      diagonal ? "border-brando/40" : "border-borda"
                    }`}
                    style={{
                      backgroundColor: diagonal
                        ? `rgba(52, 211, 153, ${alpha})`
                        : `rgba(248, 113, 113, ${alpha})`,
                    }}
                  >
                    {v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
