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
    createdAtUtc: string;
    tasks: TodoTask[];
    columns: TodoColumn[];
    boardRevision: number
}
type Scope = { organizationId: string; projectId: string }
const path = ({organizationId, projectId}: Scope) => `/organizations/${organizationId}/projects/${projectId}/todos`
const todoApi = api.enhanceEndpoints({addTagTypes: ["Todos"]}).injectEndpoints({
    endpoints: (builder) => ({
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
            query: path,
            providesTags: (_data, _error, scope) => [{type: "Todos", id: path(scope)}],
        }),
        createTodo: builder.mutation<Todo, Scope & { name: string; description: string; targetDate: string | null }>({
            query: ({name, description, targetDate, ...scope}) => ({
                url: path(scope),
                method: "POST",
                body: {name, description, targetDate}
            }),
            invalidatesTags: (_data, _error, scope) => [{type: "Todos", id: path(scope)}],
        }),
        createTodoTask: builder.mutation<TodoTask, Scope & {
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
                        ...scope
                    }) => ({
                url: `${path(scope)}/${todoId}/tasks`,
                method: "POST",
                body: {title, description, status, assigneeIds}
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
    useTodoPagesInfiniteQuery,
    useGetTodoQuery,
    useListTodosQuery,
    useCreateTodoMutation,
    useCreateTodoTaskMutation,
    useMoveTodoTaskMutation,
    useAssignTodoTaskMutation,
    useConfigureTodoColumnsMutation
} = todoApi
