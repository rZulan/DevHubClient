import test from "node:test"
import assert from "node:assert/strict"
import {directoryMemberTeams, directoryRoleGroups, directoryStats, directoryTeamMembers} from "../src/features/workshop/organization-directory.ts"

const member = (id, roleIds = ["member"]) => ({id, name: id, username: id, roleId: roleIds[0], roleIds, teamIds: []})
const organization = {
    roles: [{id: "owner", name: "Owner", order: 0, isOwnerRole: true}, {id: "lead", name: "Lead", order: 7}, {id: "member", name: "Member", order: 1000}, {id: "empty", name: "Empty", order: 4}],
    members: [{...member("alex", ["member", "owner"]), isOwner: true}, member("robin", ["member", "lead"]), member("sam"), member("new", ["deleted-role"])],
    teams: [{id: "design", name: "Design", leaderId: "alex", memberIds: ["sam", "sam", "deleted-person"]}, {id: "platform", name: "Platform", leaderId: "alex", memberIds: ["alex", "robin"]}],
    projects: [{id: "shared", teamIds: ["design", "platform"]}, {id: "no-team", teamIds: []}, {id: "deleted-team", teamIds: ["old-team"]}],
}

test("directory totals count distinct current people, leaders, and owned projects", () => {
    assert.deepEqual(directoryStats(organization), {teams: 2, leaders: 1, assigned: 3, unassigned: 1, projects: 1})
})
test("API team membership drives rosters and labels even when member teamIds are empty", () => {
    assert.deepEqual(directoryTeamMembers(organization, organization.teams[0]).map(member => member.id), ["alex", "sam"])
    assert.deepEqual(directoryMemberTeams(organization, "alex").map(team => team.id), ["design", "platform"])
    assert.deepEqual(directoryMemberTeams(organization, "sam").map(team => team.id), ["design"])
    assert.deepEqual(directoryMemberTeams(organization, "new"), [])
})
test("role chart places each person once under their highest role and retains unmatched members", () => {
    const groups = directoryRoleGroups(organization)
    assert.deepEqual(groups.map(group => [group.name, group.members.map(member => member.id)]), [
        ["Owner", ["alex"]], ["Lead", ["robin"]], ["Member", ["sam"]], ["Other members", ["new"]],
    ])
    assert.equal(new Set(groups.flatMap(group => group.members.map(member => member.id))).size, organization.members.length)
    assert.deepEqual(organization.members[1].roleIds, ["member", "lead"])
})
test("role chart retains the primary-role fallback when no additional roles are assigned", () => {
    const model = {...organization, members: [{...member("sam"), roleIds: []}]}
    assert.deepEqual(directoryRoleGroups(model).map(group => group.name), ["Member"])
})
