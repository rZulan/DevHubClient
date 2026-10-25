import {waterfallLandings} from "./sdlc-waterfall-geometry.ts"

export const sdlcModelIds = ["waterfall", "v-model", "agile", "iterative"] as const
export type SdlcModel = typeof sdlcModelIds[number]
export type SdlcPhase = {id: string; title: string; description: string; deliverables: string; pair?: string; quality?: string; exit?: string; rework?: string; optional?: boolean; ongoing?: boolean}
export type SdlcPosition = {x: number; y: number; label: "left" | "right" | "above" | "below"}
type SdlcDefinition = {title: string; color: string; cycle?: "Sprint" | "Iteration"; summary: string; guidance: string; sources: readonly {title: string; url: string}[]; phases: readonly SdlcPhase[]; positions: readonly SdlcPosition[]}
const lifecycleSource = {title: "IBM · Software development lifecycle", url: "https://www.ibm.com/think/topics/sdlc"}
const testingSource = {title: "ISTQB · Testing throughout the lifecycle (§2)", url: "https://astqb.org/assets/documents/ISTQB_CTFL_Syllabus_v4.0.1.pdf"}
const scrumSource = {title: "The Scrum Guide · Events and Increment", url: "https://scrumguides.org/scrum-guide.html"}

// Keep the original Waterfall IDs and phase order compatible with saved documents.
export const waterfallPhases = [
    {id: "requirements", title: "Requirements", description: "Agree the scope, user needs and measurable acceptance criteria before baselining the requirements.", deliverables: "Requirements specification, stakeholder approval", quality: "Review requirements for clarity, completeness and testability. Plan acceptance checks early.", exit: "Approve requirements"},
    {id: "design", title: "System design", description: "Design the architecture, data and interfaces against the approved requirements.", deliverables: "Architecture, ERD, UI designs", quality: "Review design consistency, risks and traceability to requirements.", exit: "Approve design"},
    {id: "implementation", title: "Implementation", description: "Build and integrate the system from the approved design.", deliverables: "Working code, unit tests, technical documentation", quality: "Review code and run component checks before handing the integrated system to verification.", exit: "Submit build for verification"},
    {id: "verification", title: "Verification", description: "Test the integrated system against its specification and validate acceptance criteria with stakeholders.", deliverables: "Test results, defect fixes, acceptance sign-off", quality: "Run integration, system and acceptance tests. Correct defects and repeat affected tests before release.", exit: "Tests passed · deploy", rework: "implementation"},
    {id: "deployment", title: "Deployment", description: "Release the accepted system with a deployment plan, rollback preparation and user support.", deliverables: "Release plan, production deployment, user training", quality: "Check deployment readiness, then verify the production release.", exit: "Deployment verified"},
    {id: "maintenance", title: "Maintenance", description: "Operate and support the released system. Assess changes, fix defects and regression-test updates.", deliverables: "Monitoring, support log, maintenance releases", quality: "Monitor production and assess the impact of every change before retesting.", exit: "Complete roadmap"},
] as const

// Release milestones follow the iterative loop; they do not add stars to an iteration layer.
export const iterativeReleasePhases: readonly SdlcPhase[] = [waterfallPhases[4], waterfallPhases[5]]

export const sdlcModels: Record<SdlcModel, SdlcDefinition> = {
    waterfall: {
        title: "Waterfall", color: "#6fcbd7", summary: "Approve each stage before the next. Verification failures return to implementation for correction and retesting.", guidance: "Requirements → design → implementation → verification → deployment → maintenance. Reviews and test planning start early; system testing follows the build. Rework revisits an earlier stage and invalidates later completion while preserving its notes.", sources: [lifecycleSource, testingSource], phases: waterfallPhases,
        positions: waterfallLandings.slice(0, 6).map((point, index) => ({...point,
            label: index % 2 ? "right" : "left",
        })),
    },
    "v-model": {
        title: "V Model", color: "#d8ad76", summary: "Review and plan tests down the left arm; implement at the base; execute corresponding test levels up the right arm.", guidance: "Each development activity has a corresponding test activity. Review requirements and designs and prepare tests on the left; execute component, integration, system and acceptance tests after code exists. Dashed cross-links show test-basis relationships, not an instruction to execute tests before implementation. Integration here groups component and system integration testing.", sources: [testingSource, lifecycleSource],
        phases: [
            {id: "requirements", title: "Requirements", description: "Agree on user needs and measurable acceptance criteria. Plan acceptance tests alongside the requirements.", deliverables: "User requirements, acceptance test plan", pair: "acceptance"},
            {id: "system-design", title: "System design", description: "Specify the complete system and its behavior. Derive system tests from this specification.", deliverables: "System specification, system test plan", pair: "system-testing"},
            {id: "architecture", title: "Architecture", description: "Define components and their interfaces. Plan how their interactions will be tested.", deliverables: "Architecture, interface contracts, integration test plan", pair: "integration"},
            {id: "module-design", title: "Module design", description: "Design individual modules and their expected behavior. Specify the unit tests that will verify each module.", deliverables: "Module specifications, unit test cases", pair: "unit"},
            {id: "implementation", title: "Implementation", description: "Turn the reviewed designs into working software, ready for verification at each level.", deliverables: "Working code, build artifacts, code review", quality: "Review code and prepare the test environment. Executable tests now begin on the right arm.", exit: "Build ready · component tests"},
            {id: "unit", title: "Unit testing", description: "Verify individual modules against their detailed designs before combining them.", deliverables: "Unit test results, module defect fixes", pair: "module-design"},
            {id: "integration", title: "Integration testing", description: "Verify component interfaces and interactions against the architecture.", deliverables: "Integration test results, interface defect fixes", pair: "architecture"},
            {id: "system-testing", title: "System testing", description: "Verify the integrated system against the system specification, including its nonfunctional requirements.", deliverables: "System test results, performance checks", pair: "system-design"},
            {id: "acceptance", title: "Acceptance testing", description: "Validate that the system meets the agreed user needs and acceptance criteria.", deliverables: "Acceptance results, stakeholder sign-off", pair: "requirements"},
        ],
        positions: [{x: 220, y: 160, label: "left"}, {x: 290, y: 285, label: "left"}, {x: 360, y: 410, label: "left"}, {x: 430, y: 535, label: "left"}, {x: 500, y: 660, label: "below"}, {x: 570, y: 535, label: "right"}, {x: 640, y: 410, label: "right"}, {x: 710, y: 285, label: "right"}, {x: 780, y: 160, label: "above"}],
    },
    agile: {
        title: "Agile", color: "#84cfa8", cycle: "Sprint", summary: "A Scrum workflow: plan a Sprint, develop a Done increment, review the outcome, then improve in a retrospective. Release is optional.", guidance: "Agile describes principles, not one fixed sequence. This roadmap uses Scrum. Design, build and testing overlap inside the Sprint; Daily Scrum and backlog refinement continue throughout. A Done increment can be released before Sprint Review. Review and Retrospective are separate events; a release is never required to finish a Sprint. The activity stars track focus, not mandatory handoffs between separate teams.", sources: [scrumSource, {title: "Agile Manifesto · Principles", url: "https://agilemanifesto.org/principles.html"}, testingSource],
        phases: [
            {id: "backlog", title: "Backlog refinement", description: "Keep the Product Backlog ordered and clarify upcoming work. Refinement continues throughout development.", deliverables: "Ordered Product Backlog, clarified acceptance criteria", quality: "Discuss value, uncertainty and testability with the Product Owner and team.", exit: "Ready for Sprint planning", ongoing: true},
            {id: "planning", title: "Sprint planning", description: "Agree why this Sprint is valuable, what can be Done and how the team will approach it.", deliverables: "Sprint Goal, Sprint Backlog, initial delivery plan", quality: "Make the Sprint Goal explicit and use the Definition of Done to guide the work.", exit: "Start Sprint development"},
            {id: "design", title: "Design", description: "Collaborate on just enough design, adapting alongside implementation and testing during the Sprint.", deliverables: "Design sketches, technical approach", quality: "Review design assumptions continuously. Design can be revisited as tests and implementation reveal more.", exit: "Focus on building"},
            {id: "build", title: "Build", description: "Build and integrate usable improvements with testing and design happening alongside the work.", deliverables: "Integrated increment, reviewed code", quality: "Use code review, integration checks and regression tests continuously. Inspect progress at the Daily Scrum.", exit: "Check the increment"},
            {id: "test", title: "Done increment", description: "Check the integrated increment against the team's Definition of Done. Unfinished work returns to development or the Product Backlog.", deliverables: "Verified increment, Definition of Done evidence", quality: "An increment must meet the Definition of Done before release. Passing tests alone is not the full Definition of Done.", exit: "Done · Sprint Review", rework: "build"},
            {id: "release", title: "Release", description: "Optionally deliver the Done increment. Release timing is independent of Sprint Review and the Sprint boundary.", deliverables: "Released increment, release notes", quality: "Confirm the Definition of Done and release readiness. Review is not a release approval gate.", exit: "Record release · review", optional: true},
            {id: "review", title: "Sprint Review", description: "Inspect the Sprint outcome with stakeholders and adapt the Product Backlog toward the Product Goal.", deliverables: "Stakeholder feedback, adapted Product Backlog", quality: "Collaborate on what to do next. This working session is separate from the team's Retrospective.", exit: "Continue to Retrospective"},
            {id: "retrospective", title: "Retrospective", description: "Inspect how the team worked and plan improvements to quality and effectiveness. Then begin the next Sprint.", deliverables: "Team improvements, next Sprint adaptations", quality: "Discuss people, interactions, processes, tools and the Definition of Done. Carry useful improvements into the next Sprint.", exit: "Complete Sprint"},
        ],
        positions: [{x: 250, y: 140, label: "left"}, {x: 500, y: 170, label: "above"}, {x: 715, y: 320, label: "right"}, {x: 755, y: 475, label: "right"}, {x: 565, y: 635, label: "below"}, {x: 820, y: 700, label: "below"}, {x: 330, y: 690, label: "left"}, {x: 205, y: 460, label: "left"}],
    },
    iterative: {
        title: "Iterative", color: "#b49ae8", cycle: "Iteration", summary: "Build and evaluate a working version each iteration. Use feedback to repeat or proceed to deployment and maintenance.", guidance: "Each tornado layer represents planning, analysis, design, implementation, testing and evaluation of a working version. Review and test throughout each iteration, including regression testing. After evaluation, repeat with feedback or take the release path. Later operational feedback can justify another iteration; starting one is an explicit choice.", sources: [testingSource, lifecycleSource, {title: "IBM · Iterative development", url: "https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/workflow-management/7.1.0?topic=scenarios-iterative-development"}],
        phases: [
            {id: "planning", title: "Plan", description: "Review what was learned and choose the goals and risks to address in this iteration.", deliverables: "Iteration goals, prioritized improvements"},
            {id: "analysis", title: "Analyze", description: "Explore the selected requirements and feedback, refining your understanding of the system.", deliverables: "Refined requirements, risk assessment"},
            {id: "design", title: "Design", description: "Evolve the architecture and designs to support this iteration's improvements.", deliverables: "Updated designs, implementation plan"},
            {id: "build", title: "Build", description: "Implement and integrate the next version of the system.", deliverables: "Updated software, technical documentation"},
            {id: "test", title: "Test", description: "Verify the updated version and run regression checks on previously working behavior.", deliverables: "Test results, regression results, defect fixes", rework: "build"},
            {id: "evaluate", title: "Evaluate", description: "Review test results and stakeholder feedback. Decide whether the version needs another iteration or meets the criteria for release.", deliverables: "Evaluation findings, stakeholder feedback, release readiness decision"},
        ],
        positions: [{x: 365, y: 465, label: "below"}, {x: 265, y: 415, label: "left"}, {x: 290, y: 255, label: "left"}, {x: 535, y: 105, label: "right"}, {x: 750, y: 330, label: "right"}, {x: 830, y: 635, label: "left"}],
    },
}

export function isSdlcModel(value: unknown): value is SdlcModel {return typeof value === "string" && (sdlcModelIds as readonly string[]).includes(value)}
