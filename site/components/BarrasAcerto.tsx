import { pct } from "@/lib/formato";

type ItemAcerto = { rotulo: string; valor: number | null; destaque?: boolean; nota?: string };

export function BarrasAcerto({ itens }: { itens: ItemAcerto[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {itens.map((item, i) => {
        const v = item.valor === null ? null : Math.max(0, Math.min(1, item.valor));
        return (
          <li
            key={`${item.rotulo}-${i}`}
            className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_3rem] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_3.5rem] sm:gap-x-4"
          >
            <span
              className={`text-sm leading-snug ${item.destaque ? "font-medium text-tinta" : "text-tinta-2"}`}
            >
              {item.rotulo}
            </span>
            {v === null ? (
              <span className="col-span-2">
                <span className="aguardando">aguardando</span>
              </span>
            ) : (
              <>
                <span className="relative block h-1.5 rounded-full bg-papel-3" aria-hidden="true">
                  <span
                    className={`absolute inset-y-0 left-0 rounded-full ${item.destaque ? "bg-acento" : "bg-tinta-3"}`}
                    style={{ width: `${v * 100}%` }}
                  />
                </span>
                <span
                  className={`num text-right text-sm font-medium ${item.destaque ? "text-tinta" : "text-tinta-2"}`}
                >
                  {pct(item.valor)}
                </span>
              </>
            )}
            {item.nota && (
              <span className="col-span-2 col-start-2 text-xs leading-snug text-tinta-3">{item.nota}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
