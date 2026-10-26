import type {TodoColumn, TodoTask} from "./todo-api"
import "./todo-board-progress.css"

const columnColors = ["#94a3b8", "#fbbf24", "#38bdf8", "#c4b5fd"]

export function TodoBoardProgress({tasks, columns, busy = false}: {
    tasks: readonly Pick<TodoTask, "status">[]; columns: readonly TodoColumn[]; busy?: boolean
}) {
    const total = tasks.length
    const segments = columns.map((column, index) => ({...column,
        count: tasks.filter(task => task.status === column.id).length,
        color: index === columns.length - 1 ? "#86efac" : columnColors[index % columnColors.length],
    }))
    const completed = segments.at(-1)?.count ?? 0
    const percent = total ? Math.round(completed / total * 100) : 0
    return <div className="todo-board-progress" aria-busy={busy}>
        <div className="todo-board-progress-caption">
            <div className="todo-board-progress-legend">{segments.map(segment => <span key={segment.id}><i style={{backgroundColor: segment.color}} aria-hidden="true"/>{segment.name}<b>{segment.count}</b></span>)}</div>
            <span className="todo-board-progress-summary">{completed} of {total} complete <strong>{percent}%</strong></span>
        </div>
        <div className="todo-board-progress-track" role="progressbar" aria-label="Task board progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
            aria-valuetext={`${completed} of ${total} tasks complete (${percent}%). ${segments.map(segment => `${segment.name}: ${segment.count}`).join("; ")}`}>
            {segments.filter(segment => segment.count > 0).map(segment => <span key={segment.id} style={{width: `${segment.count / total * 100}%`, backgroundColor: segment.color}} title={`${segment.name}: ${segment.count} of ${total}`}/>)}
        </div>
    </div>
}
