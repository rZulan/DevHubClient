export function downloadUmlFile(name:string,content:Blob) {
    const url=URL.createObjectURL(content),anchor=document.createElement("a")
    anchor.href=url
    anchor.download=name
    anchor.click()
    setTimeout(()=>URL.revokeObjectURL(url),1000)
}
