import {api} from "@/services/api"

export type TodoTask = {
    id: string;
    todoId: string;
    projectId: string;
    title: string;
    description: string;
    status: string;
    assigneeId: string | null;
    assigneeIds: string[]
    startDate?: string | null;
    targetDate?: string | null;
}
export type TodoColumn = { id: string; name: string }
export const defaultTodoColumns: TodoColumn[] = [{id: "pending", name: "Pending"}, {
    id: "progress",
    name: "In progress"
}, {id: "done", name: "Done"}]
export type Todo = {
    id: string;
    projectId: string;
    name: string;
    description: string;
    targetDate: string | null;
    startDate?: string | null;
    createdAtUtc: string;
    tasks: TodoTask[];
    columns: TodoColumn[];
    boardRevision: number
}
type Scope = { organizationId: string; projectId: string }
export type TodoDates = {startDate: string | null; targetDate: string | null}
export type TodoTaskDetails = {title: string; description: string; status: string; assigneeIds: string[]} & TodoDates
const path = ({organizationId, projectId}: Scope) => `/organizations/${organizationId}/projects/${projectId}/todos`
export const todoApi = api.enhanceEndpoints({addTagTypes: ["Todos"]}).injectEndpoints({
    endpoints: (builder) => ({
        updateTodoDates: builder.mutation<Todo, Scope & TodoDates & {todoId: string; boardRevision: number}>({
            query: ({todoId, startDate, targetDate, boardRevision, ...scope}) => ({url: `${path(scope)}/${todoId}/dates`, method: "PATCH", body: {startDate, targetDate, boardRevision}}),
            invalidatesTags: (_data, _error, scope) => [{type: "Todos", id: path(scope)}],
        }),
        updateTodoTask: builder.mutation<TodoTask, Scope & TodoTaskDetails & {todoId: string; taskId: string; boardRevision: number}>({
            query: ({todoId, taskId, title, description, status, assigneeIds, boardRevision, startDate, targetDate, ...scope}) => ({
                url: `${path(scope)}/${todoId}/tasks/${taskId}`, method: "PUT", body: {title, description, status, assigneeIds, boardRevision, startDate, targetDate}
            }),
            invalidatesTags: (_data, _error, scope) => [{type: "Todos", id: path(scope)}],
        }),
        deleteTodoTask: builder.mutation<void, Scope & {todoId: string; taskId: string; boardRevision: number}>({
            query: ({todoId, taskId, boardRevision, ...scope}) => ({
                url: `${path(scope)}/${todoId}/tasks/${taskId}`, method: "DELETE", body: {boardRevision}
            }),
            invalidatesTags: (_data, _error, scope) => [{type: "Todos", id: path(scope)}],
        }),
        todoPages: builder.infiniteQuery<{ items: Todo[]; hasMore: boolean }, Scope & { pageSize: number }, number>({
            infiniteQueryOptions: {
                initialPageParam: 0,
                getNextPageParam: (lastPage, _pages, lastPageParam) => lastPage.hasMore ? lastPageParam + 1 : undefined,
            },
            query: ({queryArg, pageParam}) => `${path(queryArg)}/pages?page=${pageParam}&pageSize=${queryArg.pageSize}`,
            providesTags: (_data, _error, scope) => [{type: "Todos", id: path(scope)}],
        }),
        getTodo: builder.query<Todo, Scope & { todoId: string }>({
            query: ({todoId, ...scope}) => `${path(scope)}/${todoId}`,
            providesTags: (_data, _error, scope) => [{type: "Todos", id: path(scope)}],
        }),
        listTodos: builder.query<Todo[], Scope>({
            async queryFn(scope, _api, _options, baseQuery) {
                const items: Todo[] = []
                for (let page = 0; ; page++) {
                    const result = await baseQuery(`${path(scope)}/pages?page=${page}&pageSize=50`)
                    if (result.error) return {error: result.error}
                    const batch = result.data as {items: Todo[]; hasMore: boolean}
                    items.push(...batch.items)
                    if (!batch.hasMore) return {data: items}
                }
            },
            providesTags: (_data, _error, scope) => [{type: "Todos", id: path(scope)}],
        }),
        createTodo: builder.mutation<Todo, Scope & TodoDates & { name: string; description: string }>({
            query: ({name, description, targetDate, startDate, ...scope}) => ({
                url: path(scope),
                method: "POST",
                body: {name, description, targetDate, startDate}
            }),
            invalidatesTags: (_data, _error, scope) => [{type: "Todos", id: path(scope)}],
        }),
        createTodoTask: builder.mutation<TodoTask, Scope & TodoDates & {
            todoId: string;
            title: string;
            description: string;
            status: string;
            assigneeIds: string[]
        }>({
            query: ({
                        todoId,
                        title,
                        description,
                        status,
                        assigneeIds,
                        startDate,
                        targetDate,
                        ...scope
                    }) => ({
                url: `${path(scope)}/${todoId}/tasks`,
                method: "POST",
                body: {title, description, status, assigneeIds, startDate, targetDate}
            }),
            invalidatesTags: (_data, _error, scope) => [{type: "Todos", id: path(scope)}],
        }),
        configureTodoColumns: builder.mutation<Todo, Scope & {
            todoId: string;
            columns: TodoColumn[];
            boardRevision: number
        }>({
            query: ({todoId, columns, boardRevision, ...scope}) => ({
                url: `${path(scope)}/${todoId}/columns`,
                method: "PATCH",
                body: {columns, boardRevision}
            }),
            invalidatesTags: (_data, _error, scope) => [{type: "Todos", id: path(scope)}],
        }),
        assignTodoTask: builder.mutation<TodoTask, Scope & {
            todoId: string;
            taskId: string;
            userId: string;
            remove: boolean
        }>({
            query: ({
                        todoId,
                        taskId,
                        userId,
                        remove,
                        ...scope
                    }) => ({
                url: `${path(scope)}/${todoId}/tasks/${taskId}/assignees`,
                method: "PATCH",
                body: {userId, remove}
            }),
            invalidatesTags: (_data, _error, scope) => [{type: "Todos", id: path(scope)}],
        }),
        moveTodoTask: builder.mutation<TodoTask, Scope & { todoId: string; taskId: string; status: string }>({
            query: ({todoId, taskId, status, ...scope}) => ({
                url: `${path(scope)}/${todoId}/tasks/${taskId}`,
                method: "PATCH",
                body: {status}
            }),
            invalidatesTags: (_data, _error, scope) => [{type: "Todos", id: path(scope)}],
        }),
    }),
})
export const {
    useUpdateTodoDatesMutation,
    useUpdateTodoTaskMutation,
    useDeleteTodoTaskMutation,
    useTodoPagesInfiniteQuery,
    useGetTodoQuery,
    useListTodosQuery,
    useCreateTodoMutation,
    useCreateTodoTaskMutation,
    useMoveTodoTaskMutation,
    useAssignTodoTaskMutation,
    useConfigureTodoColumnsMutation
} = todoApi
