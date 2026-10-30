import type { Job } from "../comparison/types";
import { isActive, statusLabels } from "../comparison/types";
import { dateLabel } from "../shared/format";

export default function HistoryPage({
  jobs,
  open,
  remove,
}: {
  jobs: Job[];
  open: (job: Job) => void;
  remove: (job: Job) => void;
}) {
  return (
    <>
      <h1>比較履歴</h1>
      <p className="muted">比較データは24時間後に自動削除されます。</p>
      {jobs.length ? (
        <div className="panel table-panel">
          <table>
            <thead>
              <tr>
                <th>ファイル</th>
                <th>日時</th>
                <th>状態</th>
                <th>差分</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td>
                    {j.originalName} → {j.revisedName}
                  </td>
                  <td>{dateLabel(j.createdAt)}</td>
                  <td className={"status " + j.status.toLowerCase()}>
                    {statusLabels[j.status]}
                  </td>
                  <td>
                    {j.status === "COMPLETED" ? `${j.changeCount}件` : "—"}
                  </td>
                  <td>
                    <button onClick={() => open(j)}>開く</button>{" "}
                    <button
                      aria-label={`${j.originalName}の比較を削除`}
                      disabled={isActive(j)}
                      onClick={() => remove(j)}
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="panel muted">まだ比較履歴がありません</p>
      )}
    </>
  );
}
