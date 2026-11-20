import { useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import './App.css'

const TYPES_CREDIT = [
  { value: 'CREDIT_BAIL', label: 'Crédit-bail' },
  { value: 'CREDIT_PERSONNEL', label: 'Crédit personnel' },
  { value: 'CREDIT_IMMOBILIER', label: 'Crédit immobilier' },
  { value: 'CREDIT_SCOLAIRE', label:  'Crédit personnel' },
  { value: 'CREDIT_INVESTISSEMENT', label: 'Crédit investissement' },
  { value: 'AUTRE', label: 'Autre type de financement' },
]

const INITIAL_STATE = {
  typeCredit: 'CREDIT_BAIL',
  montant: '',
  taux: '',
  duree: '',
  paiementsParAn: '12',
  tauxDepotGarantie: '',
  tauxPremierLoyer: '',
  tauxValeurResiduelle: '',
  dateMiseEnPlace: new Date().toISOString().split('T')[0],
  dateReelleMiseEnPlace: new Date().toISOString().split('T')[0],
}

// Fonctions utilitaires isolées de l'interface
const formatMontant = (val) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(val || 0)

const formatDate = (date) => {
  if (!date || Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR').format(date)
}

const getDateEcheance = (dateDepart, index, frequence) => {
  if (!dateDepart) return null
  const [annee, mois, jour] = dateDepart.split('-').map(Number)
  if (!annee || !mois || !jour) return null

  const decalageMois = Math.round((index * 12) / frequence)
  const date = new Date(annee, mois - 1 + decalageMois, 1, 12)
  const dernierJourDuMois = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12).getDate()

  date.setDate(Math.min(jour, dernierJourDuMois))
  return date
}

export default function App() {
  const [form, setForm] = useState(INITIAL_STATE)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const resetForm = () => setForm(INITIAL_STATE)

  // Calculs financiers centralisés
  const simulation = useMemo(() => {
    const capital = Math.max(0, Number(form.montant) || 0)
    const tauxAnnuel = Math.max(0, Number(form.taux) || 0)
    const dureeMois = Math.max(0, Math.floor(Number(form.duree) || 0))
    const frequence = Math.max(1, Math.floor(Number(form.paiementsParAn) || 12))

    const nbEcheances = Math.ceil((dureeMois / 12) * frequence)
    const tauxPeriode = tauxAnnuel / 100 / frequence

    let loyer = 0
    if (capital > 0 && nbEcheances > 0) {
      loyer =
        tauxPeriode === 0
          ? capital / nbEcheances
          : (capital * tauxPeriode) / (1 - Math.pow(1 + tauxPeriode, -nbEcheances))
    }

    const echeancier = []
    let solde = capital

    for (let i = 1; i <= nbEcheances && loyer > 0; i++) {
      const interets = solde * tauxPeriode
      const principal = Math.min(solde, Math.max(0, loyer - interets))
      solde = Math.max(0, solde - principal)

      echeancier.push({
        numero: i,
        date: getDateEcheance(form.dateMiseEnPlace, i, frequence),
        loyer,
        interets,
        principal,
        solde,
      })
    }

    const totalLoyers = loyer * nbEcheances
    const coutTotal = Math.max(0, totalLoyers - capital)

    return {
      capital,
      tauxAnnuel,
      dureeMois,
      frequence,
      nbEcheances,
      loyer,
      totalLoyers,
      coutTotal,
      echeancier,
    }
  }, [form])

  const handleExportJSON = () => {
    const payload = {
      amount: simulation.capital,
      rate: simulation.tauxAnnuel,
      duration: simulation.dureeMois,
      paymentsPerYear: simulation.frequence,
      securityDepositRate: Number(form.tauxDepotGarantie) || 0,
      firstRentInstallmentRate: Number(form.tauxPremierLoyer) || 0,
      residualValueRate: Number(form.tauxValeurResiduelle) || 0,
      commissioningDate: form.dateMiseEnPlace,
      realCommissioningDate: form.dateReelleMiseEnPlace,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'parametres-credit-bail.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportExcel = () => {
    if (!simulation.echeancier.length) {
      alert('Veuillez renseigner un montant, un taux et une durée.')
      return
    }

    const rows = simulation.echeancier.map((item) => ({
      'Échéance': item.numero,
      'Date de versement': formatDate(item.date),
      'Loyer (FCFA)': Math.round(item.loyer),
      'Intérêts (FCFA)': Math.round(item.interets),
      'Capital remboursé (FCFA)': Math.round(item.principal),
      'Solde restant (FCFA)': Math.round(item.solde),
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Amortissement')
    XLSX.writeFile(workbook, 'tableau-amortissement.xlsx')
  }

  const libelleCredit = TYPES_CREDIT.find((t) => t.value === form.typeCredit)?.label

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="brand-icon">CB</div>
          <div>
            <h1>Simulateur de crédit-bail</h1>
            <p>Outil d'évaluation financière</p>
          </div>
        </div>
      </header>

      <main className="main">
        <section className="intro">
          <p className="eyebrow">FINANCEMENT DES PROJETS</p>
          <h2>Paramétrage du contrat</h2>
          <p>Saisissez les conditions financières pour obtenir l'échéancier détaillé.</p>
        </section>

        <section className="simulation-layout">
          <div className="panel form-panel">
            <div className="panel-heading">
              <div>
                <h3>Données du financement</h3>
                <p>Tous les montants sont exprimés en FCFA.</p>
              </div>
              <span className="step">ÉTAPE 1</span>
            </div>

            <div className="form-grid">
              <div className="field field-full">
                <label htmlFor="typeCredit">Type de crédit</label>
                <select
                  id="typeCredit"
                  name="typeCredit"
                  value={form.typeCredit}
                  onChange={handleChange}
                >
                  {TYPES_CREDIT.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field field-full">
                <div className="label-line">
                  <label htmlFor="montant">Montant du financement (FCFA)</label>
                  <strong className="field-value">{formatMontant(simulation.capital)} FCFA</strong>
                </div>
                <input
                  id="montant"
                  name="montant"
                  type="number"
                  min="0"
                  step="1000"
                  value={form.montant}
                  onChange={handleChange}
                  placeholder="Ex. : 10000000"
                />
                <input
                  className="range-input"
                  name="montant"
                  type="range"
                  min="1000000"
                  max="1000000000"
                  step="1000000"
                  value={Math.min(1000000000, Math.max(1000000, simulation.capital || 1000000))}
                  onChange={handleChange}
                />
              </div>

              <div className="field">
                <div className="label-line">
                  <label htmlFor="taux">Taux annuel (%)</label>
                  <strong className="field-value">{form.taux || '—'} %</strong>
                </div>
                <input
                  id="taux"
                  name="taux"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.taux}
                  onChange={handleChange}
                  placeholder="Ex. : 4"
                />
                <input
                  className="range-input"
                  name="taux"
                  type="range"
                  min="0"
                  max="12"
                  step="0.1"
                  value={Math.min(12, simulation.tauxAnnuel)}
                  onChange={handleChange}
                />
              </div>

              <div className="field">
                <div className="label-line">
                  <label htmlFor="duree">Durée du contrat (mois)</label>
                  <strong className="field-value">{form.duree || '—'} mois</strong>
                </div>
                <input
                  id="duree"
                  name="duree"
                  type="number"
                  min="1"
                  max="240"
                  value={form.duree}
                  onChange={handleChange}
                  placeholder="Ex. : 64"
                />
                <input
                  className="range-input"
                  name="duree"
                  type="range"
                  min="12"
                  max="240"
                  step="1"
                  value={Math.min(240, Math.max(12, simulation.dureeMois || 12))}
                  onChange={handleChange}
                />
              </div>

              <div className="field">
                <label htmlFor="paiementsParAn">Périodicité</label>
                <select
                  id="paiementsParAn"
                  name="paiementsParAn"
                  value={form.paiementsParAn}
                  onChange={handleChange}
                >
                  <option value="1">Annuelle (1/an)</option>
                  <option value="2">Semestrielle (2/an)</option>
                  <option value="4">Trimestrielle (4/an)</option>
                  <option value="12">Mensuelle (12/an)</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="tauxDepotGarantie">Dépôt de garantie (%)</label>
                <input
                  id="tauxDepotGarantie"
                  name="tauxDepotGarantie"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.tauxDepotGarantie}
                  onChange={handleChange}
                  placeholder="Ex. : 5"
                />
              </div>

              <div className="field">
                <label htmlFor="tauxPremierLoyer">Premier loyer majoré (%)</label>
                <input
                  id="tauxPremierLoyer"
                  name="tauxPremierLoyer"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.tauxPremierLoyer}
                  onChange={handleChange}
                  placeholder="Ex. : 10"
                />
              </div>

              <div className="field">
                <label htmlFor="tauxValeurResiduelle">Valeur résiduelle (%)</label>
                <input
                  id="tauxValeurResiduelle"
                  name="tauxValeurResiduelle"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.tauxValeurResiduelle}
                  onChange={handleChange}
                  placeholder="Ex. : 1"
                />
              </div>

              <div className="field">
                <label htmlFor="dateMiseEnPlace">Date de mise en place</label>
                <input
                  id="dateMiseEnPlace"
                  name="dateMiseEnPlace"
                  type="date"
                  value={form.dateMiseEnPlace}
                  onChange={handleChange}
                />
              </div>

              <div className="field">
                <label htmlFor="dateReelleMiseEnPlace">Date réelle de mise en place</label>
                <input
                  id="dateReelleMiseEnPlace"
                  name="dateReelleMiseEnPlace"
                  type="date"
                  value={form.dateReelleMiseEnPlace}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <aside className="result-panel">
            <p className="eyebrow">SYNTHÈSE</p>
            <h3>Récapitulatif</h3>

            <div className="result-list">
              <div>
                <span>Type de crédit</span>
                <strong>{libelleCredit}</strong>
              </div>
              <div>
                <span>Capital financé</span>
                <strong>{formatMontant(simulation.capital)} FCFA</strong>
              </div>
              <div>
                <span>Taux annuel</span>
                <strong>{simulation.tauxAnnuel} %</strong>
              </div>
              <div>
                <span>Durée</span>
                <strong>{simulation.dureeMois} mois</strong>
              </div>
              <div>
                <span>Loyer par échéance</span>
                <strong>{formatMontant(simulation.loyer)} FCFA</strong>
              </div>
              <div>
                <span>Nombre d'échéances</span>
                <strong>{simulation.nbEcheances}</strong>
              </div>
            </div>

            <div className="result-actions">
              <button className="secondary-button" type="button" onClick={resetForm}>
                Réinitialiser
              </button>
              <button className="primary-button" type="button" onClick={handleExportJSON}>
                Exporter JSON
              </button>
            </div>
          </aside>
        </section>

        <section className="stats-grid">
          <div className="panel stat-card">
            <p>Capital de départ</p>
            <h3>{formatMontant(simulation.capital)} FCFA</h3>
          </div>
          <div className="panel stat-card">
            <p>Cumul des loyers</p>
            <h3>{formatMontant(simulation.totalLoyers)} FCFA</h3>
          </div>
          <div className="panel stat-card">
            <p>Coût total du financement</p>
            <h3>{formatMontant(simulation.coutTotal)} FCFA</h3>
          </div>
          <div className="panel stat-card">
            <p>Échéances</p>
            <h3>{simulation.nbEcheances}</h3>
          </div>
        </section>

        <section className="panel amortissement-panel">
          <div className="panel-heading">
            <div>
              <h3>Tableau d’amortissement</h3>
              <p>Détail prévisionnel des remboursements par période.</p>
            </div>
            <button className="export-button" type="button" onClick={handleExportExcel}>
              Exporter Excel
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Date</th>
                  <th>Loyer (FCFA)</th>
                  <th>Intérêts (FCFA)</th>
                  <th>Capital (FCFA)</th>
                  <th>Solde restant (FCFA)</th>
                </tr>
              </thead>
              <tbody>
                {simulation.echeancier.length > 0 ? (
                  simulation.echeancier.map((ligne) => (
                    <tr key={ligne.numero}>
                      <td>{ligne.numero}</td>
                      <td>{formatDate(ligne.date)}</td>
                      <td>{formatMontant(ligne.loyer)}</td>
                      <td>{formatMontant(ligne.interets)}</td>
                      <td>{formatMontant(ligne.principal)}</td>
                      <td>{formatMontant(ligne.solde)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="empty-row">
                      Renseignez le montant, le taux et la durée pour générer l'échéancier.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}