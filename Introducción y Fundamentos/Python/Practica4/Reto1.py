agenda = {
    "Ana": "654123987",
    "Luis": "678555111",
    "Marta": "622444333",
}

agenda["Pedro"] = 611222333
agenda["Luis"] = 600000000

del agenda["Marta"]

print(agenda["Ana"])