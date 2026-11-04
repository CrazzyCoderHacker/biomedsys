import { useEffect, useId, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, LoaderCircle, Search } from "lucide-react"
import {
  listEquipmentInventory,
  type EquipmentInventoryDetail,
  type Role,
} from "../lib/supabase"

export type EquipmentSearchApi = typeof listEquipmentInventory

function equipmentDescription(item: EquipmentInventoryDetail) {
  return [item.manufacturer, item.model].filter(Boolean).join(" · ")
}

export function EquipmentReportSelector({
  role,
  value,
  selected,
  onInputChange,
  onSelect,
  search = listEquipmentInventory,
}: {
  role: Role
  value: string
  selected: EquipmentInventoryDetail | null
  onInputChange: (value: string) => void
  onSelect: (equipment: EquipmentInventoryDetail) => void
  search?: EquipmentSearchApi
}) {
  const listboxId = useId()
  const requestNumber = useRef(0)
  const [results, setResults] = useState<EquipmentInventoryDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [open, setOpen] = useState(false)
  const normalizedQuery = value.trim()

  useEffect(() => {
    const currentRequest = ++requestNumber.current
    if (selected?.inventory_code === normalizedQuery) {
      setResults([])
      setOpen(false)
      setLoading(false)
      return
    }
    if (normalizedQuery.length < 2) {
      setResults([])
      setOpen(false)
      setLoading(false)
      setError("")
      return
    }

    const timer = window.setTimeout(() => {
      setLoading(true)
      setError("")
      search(role, { searchTerm: normalizedQuery })
        .then((items) => {
          if (currentRequest !== requestNumber.current) return
          setResults(items.slice(0, 8))
          setOpen(true)
        })
        .catch((searchError: unknown) => {
          if (currentRequest !== requestNumber.current) return
          setResults([])
          setOpen(true)
          setError(searchError instanceof Error ? searchError.message : "No fue posible consultar los equipos.")
        })
        .finally(() => {
          if (currentRequest === requestNumber.current) setLoading(false)
        })
    }, 300)

    return () => window.clearTimeout(timer)
  }, [normalizedQuery, role, search, selected?.inventory_code])

  return (
    <div className="equipment-selector">
      <div className="equipment-selector-input">
        <Search size={17} aria-hidden="true" />
        <input
          required
          role="combobox"
          aria-label="Buscar equipo registrado"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open}
          aria-activedescendant={undefined}
          value={value}
          onChange={(event) => onInputChange(event.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Código, equipo, fabricante o modelo"
          autoComplete="off"
        />
        {loading && <LoaderCircle className="spin" size={17} aria-label="Buscando equipos" />}
      </div>

      {open && (
        <div className="equipment-selector-results" id={listboxId} role="listbox" aria-label="Equipos encontrados">
          {error ? (
            <div className="equipment-selector-state" role="alert"><AlertTriangle size={17} /><span>{error}</span></div>
          ) : results.length === 0 ? (
            <div className="equipment-selector-state"><span>No se encontraron equipos registrados.</span></div>
          ) : results.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={selected?.id === item.id}
              onClick={() => {
                onSelect(item)
                setOpen(false)
              }}
            >
              <strong>{item.inventory_code} · {item.equipment_type}</strong>
              <span>{equipmentDescription(item)}</span>
              <small>{item.hospital_area || "Área no registrada"} · {item.location || "Ubicación no registrada"}</small>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="equipment-selector-selected" role="status">
          <CheckCircle2 size={18} />
          <div>
            <strong>{selected.inventory_code} · {selected.equipment_type}</strong>
            <span>{equipmentDescription(selected)}</span>
            <small>
              Serie: {selected.serial_number || "No visible o no registrada"} · {selected.hospital_area || "Área no registrada"} · {selected.location || "Ubicación no registrada"}
            </small>
          </div>
        </div>
      )}
    </div>
  )
}
