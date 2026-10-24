import {waterfallLandings} from "./sdlc-waterfall-geometry.ts"

export const sdlcModelIds = ["waterfall", "v-model", "agile", "iterative"] as const
export type SdlcModel = typeof sdlcModelIds[number]
export type SdlcPhase = {id: string; title: string; description: string; deliverables: string; pair?: string}
export type SdlcPosition = {x: number; y: number; label: "left" | "right" | "above" | "below"}
type SdlcDefinition = {title: string; color: string; cycle?: "Sprint" | "Iteration"; summary: string; phases: readonly SdlcPhase[]; positions: readonly SdlcPosition[]; loop?: string}

// Keep the original Waterfall IDs and phase order compatible with saved documents.
export const waterfallPhases = [
    {id: "requirements", title: "Requirements", description: "Define the problem, scope and acceptance criteria.", deliverables: "Requirements specification, stakeholder approval"},
    {id: "design", title: "System design", description: "Plan the architecture, data model and user experience.", deliverables: "Architecture, ERD, UI designs"},
    {id: "implementation", title: "Implementation", description: "Build the system from the approved design.", deliverables: "Working code, unit tests, technical documentation"},
    {id: "verification", title: "Verification", description: "Validate the system against the requirements.", deliverables: "Test results, defect fixes, acceptance sign-off"},
    {id: "deployment", title: "Deployment", description: "Release the approved system to its users.", deliverables: "Release plan, production deployment, user training"},
    {id: "maintenance", title: "Maintenance", description: "Monitor, support and improve the released system.", deliverables: "Monitoring, support log, maintenance releases"},
] as const

// Release milestones follow the iterative loop; they do not add stars to an iteration layer.
export const iterativeReleasePhases: readonly SdlcPhase[] = [waterfallPhases[4], waterfallPhases[5]]

export const sdlcModels: Record<SdlcModel, SdlcDefinition> = {
    waterfall: {
        title: "Waterfall", color: "#6fcbd7", summary: "A sequential path from requirements to maintenance.", phases: waterfallPhases,
        positions: waterfallLandings.slice(0, 6).map((point, index) => ({...point,
            label: index % 2 ? "right" : "left",
        })),
    },
    "v-model": {
        title: "V Model", color: "#d8ad76", summary: "Develop down the left wing, implement at the center, then validate up the right wing.",
        phases: [
            {id: "requirements", title: "Requirements", description: "Agree on user needs and measurable acceptance criteria. Plan acceptance tests alongside the requirements.", deliverables: "User requirements, acceptance test plan", pair: "acceptance"},
            {id: "system-design", title: "System design", description: "Specify the complete system and its behavior. Derive system tests from this specification.", deliverables: "System specification, system test plan", pair: "system-testing"},
            {id: "architecture", title: "Architecture", description: "Define components and their interfaces. Plan how their interactions will be tested.", deliverables: "Architecture, interface contracts, integration test plan", pair: "integration"},
            {id: "module-design", title: "Module design", description: "Design individual modules and their expected behavior. Specify the unit tests that will verify each module.", deliverables: "Module specifications, unit test cases", pair: "unit"},
            {id: "implementation", title: "Implementation", description: "Turn the reviewed designs into working software, ready for verification at each level.", deliverables: "Working code, build artifacts, code review"},
            {id: "unit", title: "Unit testing", description: "Verify individual modules against their detailed designs before combining them.", deliverables: "Unit test results, module defect fixes", pair: "module-design"},
            {id: "integration", title: "Integration testing", description: "Verify component interfaces and interactions against the architecture.", deliverables: "Integration test results, interface defect fixes", pair: "architecture"},
            {id: "system-testing", title: "System testing", description: "Verify the integrated system against the system specification, including its nonfunctional requirements.", deliverables: "System test results, performance checks", pair: "system-design"},
            {id: "acceptance", title: "Acceptance testing", description: "Validate that the system meets the agreed user needs and acceptance criteria.", deliverables: "Acceptance results, stakeholder sign-off", pair: "requirements"},
        ],
        positions: [{x: 220, y: 160, label: "left"}, {x: 290, y: 285, label: "left"}, {x: 360, y: 410, label: "left"}, {x: 430, y: 535, label: "left"}, {x: 500, y: 660, label: "below"}, {x: 570, y: 535, label: "right"}, {x: 640, y: 410, label: "right"}, {x: 710, y: 285, label: "right"}, {x: 780, y: 160, label: "above"}],
    },
    agile: {
        title: "Agile", color: "#84cfa8", cycle: "Sprint", summary: "A repeatable delivery workflow: plan a small increment, build, test, release and learn together.",
        phases: [
            {id: "backlog", title: "Backlog refinement", description: "Gather feedback, refine user stories and prioritize the next valuable increment.", deliverables: "Prioritized stories, acceptance criteria"},
            {id: "planning", title: "Sprint planning", description: "Agree on a sprint goal and select achievable work with the team.", deliverables: "Sprint goal, sprint backlog"},
            {id: "design", title: "Design", description: "Collaborate on just enough design for the selected stories, adapting as the team learns.", deliverables: "Design sketches, technical approach"},
            {id: "build", title: "Build", description: "Implement a small usable increment, integrating changes continuously.", deliverables: "Working increment, reviewed code"},
            {id: "test", title: "Test", description: "Check the increment against acceptance criteria and the team's definition of done.", deliverables: "Test results, resolved defects"},
            {id: "release", title: "Release", description: "Make the tested increment available and observe its behavior. Release timing can follow your team's needs.", deliverables: "Released increment, release notes"},
            {id: "review", title: "Review & retrospective", description: "Inspect the outcome with stakeholders and reflect on how the team works. Feed improvements into the next sprint.", deliverables: "Stakeholder feedback, team improvements, backlog updates"},
        ],
        positions: [{x: 245, y: 120, label: "left"}, {x: 430, y: 315, label: "left"}, {x: 590, y: 345, label: "above"}, {x: 835, y: 335, label: "below"}, {x: 590, y: 500, label: "right"}, {x: 450, y: 625, label: "right"}, {x: 290, y: 755, label: "left"}],
        loop: "M290 755C125 690 104 322 245 120",
    },
    iterative: {
        title: "Iterative", color: "#b49ae8", cycle: "Iteration", summary: "After testing and evaluation, start another iteration or proceed to deployment and maintenance. Each new iteration adds a colored layer to the 3D tornado.",
        phases: [
            {id: "planning", title: "Plan", description: "Review what was learned and choose the goals and risks to address in this iteration.", deliverables: "Iteration goals, prioritized improvements"},
            {id: "analysis", title: "Analyze", description: "Explore the selected requirements and feedback, refining your understanding of the system.", deliverables: "Refined requirements, risk assessment"},
            {id: "design", title: "Design", description: "Evolve the architecture and designs to support this iteration's improvements.", deliverables: "Updated designs, implementation plan"},
            {id: "build", title: "Build", description: "Implement and integrate the next version of the system.", deliverables: "Updated software, technical documentation"},
            {id: "test", title: "Test", description: "Verify the updated version and run regression checks on previously working behavior.", deliverables: "Test results, regression results, defect fixes"},
            {id: "evaluate", title: "Evaluate", description: "Review test results and stakeholder feedback. Decide whether the version needs another iteration or meets the criteria for release.", deliverables: "Evaluation findings, stakeholder feedback, release readiness decision"},
        ],
        positions: [{x: 365, y: 465, label: "below"}, {x: 265, y: 415, label: "left"}, {x: 290, y: 255, label: "left"}, {x: 535, y: 105, label: "right"}, {x: 750, y: 330, label: "right"}, {x: 830, y: 635, label: "left"}],
        loop: "M830 635C810 451 581 421 476 530C425 581 326 560 365 465",
    },
}

export function isSdlcModel(value: unknown): value is SdlcModel {return typeof value === "string" && (sdlcModelIds as readonly string[]).includes(value)}
