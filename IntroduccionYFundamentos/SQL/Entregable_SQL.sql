-- Ejercicio 1 --

CREATE TABLE if not exists departamentos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR not NULL
)

CREATE TABLE if not exists empleados (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR,
    email VARCHAR,
    salario INTEGER,
    departamento_id BIGINT REFERENCES departamentos(id)
)

CREATE TABLE if not EXISTS proyectos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR,
    fecha_inicio DATE,
    departamento_id BIGINT REFERENCES departamentos(id)
)

-- Departamentos
INSERT INTO departamentos (nombre) VALUES
    ('Ventas'), ('Tecnología'), ('Legal'), ('I+D');
-- Empleados (Sara no tiene departamento)
INSERT INTO empleados
    (nombre, email, salario, departamento_id)
VALUES
    ('Ana',   'ana@empresa.com',   52000, 2),
    ('Luis',  'luis@empresa.com',  38000, 2),
    ('Marta', 'marta@empresa.com', 45000, 1),
    ('Pablo', 'pablo@empresa.com', 31000, 1),
    ('Sara',  'sara@empresa.com',  29000, NULL);

-- Proyectos
INSERT INTO proyectos
    (nombre, fecha_inicio, departamento_id)
VALUES
    ('Web nueva',         '2026-09-01', 2),
    ('App móvil',         '2026-11-15', 2),
    ('Campaña de verano', '2027-05-01', 1);
-- Legal e I+D no tienen empleados
-- ni proyectos

SELECT * FROM empleados
WHERE nombre ='Sara' AND departamento_id is NULL;

SELECT *
FROM empleados
INNER JOIN departamentos
ON departamentos.id = empleados.departamento_id;

-- No sale Sara ya que no tiene departamento. --

-- Ejercicio 1 Extra 1 --

SELECT *
FROM empleados
INNER JOIN departamentos
ON empleados.departamento_id = departamentos.id;

SELECT *
FROM empleados
LEFT JOIN departamentos
ON empleados.departamento_id = departamentos.id;

SELECT *
FROM empleados
RIGHT JOIN departamentos
ON empleados.departamento_id = departamentos.id;

SELECT *
FROM empleados
LEFT JOIN departamentos
ON empleados.departamento_id = departamentos.id WHERE empleados.departamento_id is NULL;

SELECT 
FROM proyectos

-- Ejercicio 1 Extra 2 --

SELECT proyectos.nombre, departamentos.nombre 
FROM proyectos
INNER JOIN departamentos
ON proyectos.departamento_id = departamentos.id

SELECT departamentos.nombre, COUNT(empleados.id)
FROM departamentos
LEFT JOIN empleados
ON empleados.departamento_id = departamentos.id
GROUP BY departamentos.nombre;

SELECT departamentos.nombre, AVG(empleados.salario), COUNT(*)
FROM empleados
INNER JOIN departamentos
ON empleados.departamento_id = departamentos.id
GROUP BY departamentos.nombre
HAVING COUNT(*) >= 2;

SELECT empleados.nombre, proyectos.nombre
FROM empleados
INNER JOIN departamentos
ON empleados.departamento_id = departamentos.id
INNER JOIN proyectos
ON proyectos.departamento_id = departamentos.id;

SELECT departamentos.nombre, empleados.nombre, empleados.salario
FROM departamentos
LEFT JOIN empleados
ON empleados.departamento_id = departamentos.id;

-- Ejercicio 2 (Subconsultas) --

SELECT *
FROM empleados
WHERE empleados.salario < (SELECT AVG(salario) FROM empleados)

SELECT *
FROM empleados
WHERE empleados.salario = (SELECT MAX(salario) FROM empleados)

SELECT *
FROM empleados
WHERE empleados.departamento_id IN (SELECT id FROM departamentos where nombre = 'Tecnología')