import pytest
from pydantic import ValidationError

from app.config import Settings


def crear(**cambios) -> Settings:
    base = {
        "postgres_user": "usuario",
        "postgres_password": "secreta",
        "postgres_db": "bd",
    }
    return Settings(_env_file=None, **{**base, **cambios})


def test_construye_la_url_de_la_base_de_datos_por_partes():
    url = crear(postgres_host="db", postgres_port=5433).database_url
    assert url.drivername == "postgresql+psycopg"
    assert (url.username, url.host, url.port, url.database) == ("usuario", "db", 5433, "bd")
    assert url.password == "secreta"


def test_escapa_los_caracteres_especiales_de_la_contrasena():
    url = crear(postgres_password="p@ss:w/rd#1").database_url
    texto = url.render_as_string(hide_password=False)
    assert "p@ss:w/rd#1" not in texto
    assert "p%40ss%3Aw%2Frd%231" in texto
    assert url.password == "p@ss:w/rd#1"


def test_la_contrasena_no_aparece_en_repr_ni_en_la_url_oculta():
    settings = crear(postgres_password="muy-secreta")
    assert "muy-secreta" not in repr(settings)
    assert "muy-secreta" not in str(settings)
    assert "muy-secreta" not in str(settings.database_url)


def test_valores_por_defecto():
    settings = crear()
    assert (settings.postgres_host, settings.postgres_port) == ("localhost", 5432)
    assert (settings.api_host, settings.api_port) == ("127.0.0.1", 8000)
    assert settings.cors_origins_lista == []


@pytest.mark.parametrize(
    ("texto", "esperado"),
    [
        ("", []),
        ("   ", []),
        ("http://localhost:5173", ["http://localhost:5173"]),
        (" http://a.com , http://b.com ,, ", ["http://a.com", "http://b.com"]),
    ],
)
def test_lista_de_origenes_cors(texto, esperado):
    assert crear(cors_origins=texto).cors_origins_lista == esperado


@pytest.mark.parametrize("falta", ["postgres_user", "postgres_password", "postgres_db"])
def test_falta_una_variable_obligatoria(falta):
    datos = {"postgres_user": "u", "postgres_password": "p", "postgres_db": "d"}
    del datos[falta]
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **datos)


def test_lee_las_variables_de_entorno(monkeypatch):
    monkeypatch.setenv("POSTGRES_USER", "desde_entorno")
    monkeypatch.setenv("POSTGRES_PASSWORD", "x")
    monkeypatch.setenv("POSTGRES_DB", "bd_entorno")
    monkeypatch.setenv("POSTGRES_PORT", "6543")
    settings = Settings(_env_file=None)
    assert settings.postgres_user == "desde_entorno"
    assert settings.postgres_port == 6543
