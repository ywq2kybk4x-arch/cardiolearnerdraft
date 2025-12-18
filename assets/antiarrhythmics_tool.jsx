import React, { useState } from 'react';

const AntiarrhythmicsTool = () => {
  const [selectedClass, setSelectedClass] = useState('overview');
  const [selectedSubclass, setSelectedSubclass] = useState(null);
  const [showECGEffects, setShowECGEffects] = useState(false);

  const drugClasses = {
    overview: {
      name: "Overview",
      subtitle: "Vaughan-Williams Classification",
      color: "#6b7280"
    },
    classI: {
      name: "Class I",
      subtitle: "Sodium Channel Blockers",
      color: "#dc2626",
      phase: 0,
      ionCurrent: "Na⁺ (in)",
      mechanism: "Block voltage-gated sodium channels, reducing the rate of phase 0 depolarization. This decreases conduction velocity and excitability.",
      effectOnAP: "Decreases slope of phase 0 (reduced dV/dt), slows conduction velocity",
      ecgEffect: "Widened QRS complex (slowed ventricular conduction)",
      clinicalUse: "Atrial and ventricular arrhythmias, WPW syndrome",
      subclasses: {
        Ia: {
          name: "Class Ia (Moderate)",
          blockStrength: "Moderate Na⁺ block",
          additionalEffect: "Also blocks K⁺ channels → prolongs repolarization",
          apEffect: "Moderate ↓ phase 0 slope + prolonged APD",
          ecgEffect: "↑ QRS duration + ↑ QT interval",
          drugs: [
            { name: "Quinidine", notes: "Also vagolytic; can cause torsades (↑QT)" },
            { name: "Procainamide", notes: "Can cause drug-induced lupus (anti-histone Ab)" },
            { name: "Disopyramide", notes: "Strong negative inotrope; anticholinergic effects" }
          ],
          uses: "AF, AFL, VT, WPW",
          sideEffects: "Torsades de pointes, GI upset, cinchonism (quinidine), lupus-like syndrome (procainamide)"
        },
        Ib: {
          name: "Class Ib (Weak)",
          blockStrength: "Weak Na⁺ block",
          additionalEffect: "Preferentially binds inactivated Na⁺ channels; shortens APD",
          apEffect: "Minimal effect on phase 0 in normal tissue; ↓ APD",
          ecgEffect: "Minimal QRS change; may shorten QT",
          drugs: [
            { name: "Lidocaine", notes: "IV only; first-line for acute VT/VF; use-dependent block" },
            { name: "Mexiletine", notes: "Oral lidocaine analog; for chronic VT" },
            { name: "Phenytoin", notes: "Also anticonvulsant; for digoxin-induced arrhythmias" }
          ],
          uses: "Ventricular arrhythmias (especially post-MI), digoxin toxicity",
          sideEffects: "CNS toxicity (tremor, seizures), minimal cardiac depression"
        },
        Ic: {
          name: "Class Ic (Strong)",
          blockStrength: "Strong Na⁺ block",
          additionalEffect: "Marked slowing of conduction; minimal effect on APD",
          apEffect: "Significant ↓ phase 0 slope; no change in APD",
          ecgEffect: "Significant QRS widening; PR prolongation",
          drugs: [
            { name: "Flecainide", notes: "Very effective but proarrhythmic; avoid in structural heart disease" },
            { name: "Propafenone", notes: "Also has weak β-blocking and Ca²⁺ blocking activity" }
          ],
          uses: "SVT, AF (only in patients WITHOUT structural heart disease - 'pill in pocket')",
          sideEffects: "Proarrhythmic (CAST trial showed ↑ mortality post-MI), negative inotropy",
          warning: "CONTRAINDICATED in structural heart disease and post-MI (CAST trial)"
        }
      }
    },
    classII: {
      name: "Class II",
      subtitle: "Beta-Adrenergic Blockers",
      color: "#2563eb",
      phase: 4,
      ionCurrent: "↓ cAMP → ↓ If and ICa",
      mechanism: "Block β₁-adrenergic receptors → decrease cAMP → reduce If (funny current) in SA node and ICa-L in AV node. This slows SA node automaticity and AV nodal conduction.",
      effectOnAP: "Decreases slope of phase 4 depolarization in pacemaker cells; prolongs AV nodal refractory period",
      ecgEffect: "↓ Heart rate (↑ RR interval), ↑ PR interval",
      clinicalUse: "Rate control in AF/AFL, SVT, post-MI arrhythmia prophylaxis",
      drugs: [
        { name: "Propranolol", notes: "Non-selective (β₁ + β₂); lipophilic; also membrane-stabilizing" },
        { name: "Metoprolol", notes: "β₁-selective; preferred in asthma/COPD" },
        { name: "Atenolol", notes: "β₁-selective; hydrophilic; renal excretion" },
        { name: "Esmolol", notes: "Ultra-short acting (t½ ~9 min); IV only; for acute situations" },
        { name: "Carvedilol", notes: "Non-selective + α₁ block; used in heart failure" }
      ],
      sideEffects: "Bradycardia, AV block, hypotension, bronchospasm, fatigue, masking hypoglycemia",
      contraindications: "Severe bradycardia, high-grade AV block, decompensated HF, severe asthma"
    },
    classIII: {
      name: "Class III",
      subtitle: "Potassium Channel Blockers",
      color: "#7c3aed",
      phase: 3,
      ionCurrent: "K⁺ (out)",
      mechanism: "Block potassium channels (primarily IKr - rapid delayed rectifier) → slows phase 3 repolarization → prolongs action potential duration (APD) and effective refractory period (ERP).",
      effectOnAP: "Prolongs phase 3 repolarization → increased APD and ERP",
      ecgEffect: "Prolonged QT interval",
      clinicalUse: "AF, AFL, VT, VF prevention",
      drugs: [
        { name: "Amiodarone", notes: "Blocks Na⁺, K⁺, Ca²⁺ channels + β-receptors (all 4 classes!). Most effective but most toxic. Long t½ (weeks-months). Causes pulmonary fibrosis, thyroid dysfunction, corneal deposits, hepatotoxicity, blue-gray skin" },
        { name: "Dronedarone", notes: "Amiodarone analog without iodine; less toxic but less effective; contraindicated in HF" },
        { name: "Sotalol", notes: "Also has β-blocking activity (Class II + III). Renally cleared. Can cause torsades." },
        { name: "Ibutilide", notes: "IV only; for acute AF/AFL cardioversion. High risk of torsades - monitor on telemetry" },
        { name: "Dofetilide", notes: "Pure IKr blocker. Must initiate in hospital with QT monitoring. Renally dosed." }
      ],
      sideEffects: "Torsades de pointes (↑QT), bradycardia",
      keyPoint: "Reverse use-dependence: more K⁺ block at slow heart rates → higher torsades risk with bradycardia"
    },
    classIV: {
      name: "Class IV",
      subtitle: "Calcium Channel Blockers",
      color: "#059669",
      phase: 2,
      ionCurrent: "Ca²⁺ (in)",
      mechanism: "Block L-type calcium channels (ICa-L). In SA and AV nodes, Ca²⁺ current drives phase 0 depolarization (unlike ventricles where Na⁺ does). Slows conduction through AV node.",
      effectOnAP: "Decreases phase 2 plateau; in nodal tissue, decreases phase 0 slope and phase 4 slope",
      ecgEffect: "↓ Heart rate, ↑ PR interval (slowed AV conduction)",
      clinicalUse: "Rate control in AF/AFL, SVT (especially AVNRT), termination of PSVT",
      drugs: [
        { name: "Verapamil", notes: "Phenylalkylamine. Most potent cardiac effects. Also negative inotrope. Avoid in HF and with β-blockers (risk of severe bradycardia/heart block)" },
        { name: "Diltiazem", notes: "Benzothiazepine. Balanced cardiac and vascular effects. Commonly used for rate control in AF" }
      ],
      notIncluded: "Dihydropyridines (amlodipine, nifedipine) - primarily vascular, minimal cardiac effect, NOT antiarrhythmic",
      sideEffects: "Bradycardia, AV block, hypotension, constipation (verapamil), negative inotropy",
      contraindications: "WPW with AF (can accelerate accessory pathway conduction → VF), severe HF, concurrent β-blocker use"
    },
    other: {
      name: "Other",
      subtitle: "Miscellaneous Agents",
      color: "#d97706",
      drugs: [
        { 
          name: "Adenosine", 
          mechanism: "Activates A₁ receptors → opens K⁺ channels (IKAdo) → hyperpolarizes SA/AV nodal cells; also ↓ cAMP → ↓ ICa",
          effect: "Transient AV block (seconds)",
          use: "First-line for PSVT (AVNRT, AVRT); diagnostic for wide-complex tachycardia",
          notes: "Ultra-short t½ (~10 sec). Give rapid IV push followed by flush. Side effects: flushing, chest tightness, transient asystole (normal). Contraindicated in asthma (bronchoconstriction)."
        },
        { 
          name: "Digoxin", 
          mechanism: "Inhibits Na⁺/K⁺-ATPase → ↑ intracellular Ca²⁺ (inotropy); also increases vagal tone → slows AV conduction",
          effect: "↓ AV conduction, ↑ vagal tone",
          use: "Rate control in AF (especially with HF); rarely used alone now",
          notes: "Narrow therapeutic index. Toxicity: visual changes (yellow-green halos), GI upset, arrhythmias. Hypokalemia increases toxicity."
        },
        { 
          name: "Magnesium", 
          mechanism: "Stabilizes cardiac membranes; suppresses EADs (early afterdepolarizations)",
          effect: "↓ triggered activity, membrane stabilization",
          use: "Torsades de pointes (first-line), digoxin toxicity, refractory VF",
          notes: "IV magnesium sulfate 1-2g. Works even if Mg level is normal."
        },
        {
          name: "Atropine",
          mechanism: "Muscarinic (M₂) receptor antagonist → blocks vagal effects on heart",
          effect: "↑ SA node firing, ↑ AV conduction",
          use: "Symptomatic bradycardia, AV block (temporary)",
          notes: "0.5-1mg IV. May be ineffective in heart transplant (denervated heart)."
        }
      ]
    }
  };

  // Action Potential SVG Component
  const ActionPotential = ({ highlightPhase, highlightColor }) => {
    return (
      <svg viewBox="0 0 500 350" className="w-full h-auto">
        {/* Background */}
        <rect x="0" y="0" width="500" height="350" fill="#e0f2fe" />
        
        {/* Grid lines */}
        <g stroke="#bfdbfe" strokeWidth="0.5" opacity="0.5">
          {[50, 100, 150, 200, 250].map(y => (
            <line key={y} x1="40" y1={y} x2="460" y2={y} />
          ))}
          {[100, 150, 200, 250, 300, 350, 400].map(x => (
            <line key={x} x1={x} y1="30" x2={x} y2="280" />
          ))}
        </g>

        {/* Y-axis label */}
        <text x="15" y="150" fontSize="10" fill="#1e40af" transform="rotate(-90, 15, 150)">Membrane Potential (mV)</text>
        
        {/* Y-axis values */}
        <text x="35" y="55" fontSize="9" fill="#64748b" textAnchor="end">+20</text>
        <text x="35" y="105" fontSize="9" fill="#64748b" textAnchor="end">0</text>
        <text x="35" y="180" fontSize="9" fill="#64748b" textAnchor="end">-50</text>
        <text x="35" y="260" fontSize="9" fill="#64748b" textAnchor="end">-90</text>

        {/* Phase highlight backgrounds */}
        {highlightPhase === 0 && (
          <rect x="95" y="30" width="35" height="230" fill={highlightColor} opacity="0.2" rx="3" />
        )}
        {highlightPhase === 1 && (
          <rect x="130" y="30" width="30" height="230" fill={highlightColor} opacity="0.2" rx="3" />
        )}
        {highlightPhase === 2 && (
          <rect x="160" y="30" width="120" height="230" fill={highlightColor} opacity="0.2" rx="3" />
        )}
        {highlightPhase === 3 && (
          <rect x="280" y="30" width="80" height="230" fill={highlightColor} opacity="0.2" rx="3" />
        )}
        {highlightPhase === 4 && (
          <>
            <rect x="40" y="30" width="55" height="230" fill={highlightColor} opacity="0.2" rx="3" />
            <rect x="360" y="30" width="100" height="230" fill={highlightColor} opacity="0.2" rx="3" />
          </>
        )}

        {/* Action Potential Curve */}
        <path
          d="M 50 250 
             L 95 250 
             L 100 250
             L 115 50
             L 130 70
             L 160 65
             L 280 75
             L 320 150
             L 360 250
             L 450 250"
          fill="none"
          stroke="#dc2626"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Phase Labels */}
        <text x="110" y="140" fontSize="14" fontWeight="bold" fill="#1f2937">0</text>
        <text x="143" y="85" fontSize="14" fontWeight="bold" fill="#1f2937">1</text>
        <text x="215" y="60" fontSize="14" fontWeight="bold" fill="#1f2937">2</text>
        <text x="330" y="180" fontSize="14" fontWeight="bold" fill="#1f2937">3</text>
        <text x="70" y="240" fontSize="14" fontWeight="bold" fill="#1f2937">4</text>
        <text x="400" y="240" fontSize="14" fontWeight="bold" fill="#1f2937">4</text>

        {/* Ion Current Labels with boxes */}
        {/* Na+ in - Phase 0 */}
        <g>
          <rect x="45" y="165" width="55" height="22" fill="white" stroke="#64748b" strokeWidth="1" rx="2" />
          <text x="72" y="180" fontSize="10" fill="#1f2937" textAnchor="middle">Na⁺ (in)</text>
          <line x1="100" y1="176" x2="108" y2="150" stroke="#1e40af" strokeWidth="1.5" markerEnd="url(#arrowBlue)" />
        </g>

        {/* K+/Cl- out - Phase 1 */}
        <g>
          <rect x="135" y="25" width="60" height="22" fill="white" stroke="#64748b" strokeWidth="1" rx="2" />
          <text x="165" y="40" fontSize="10" fill="#1f2937" textAnchor="middle">K⁺/Cl⁻ (out)</text>
          <line x1="165" y1="47" x2="145" y2="65" stroke="#1e40af" strokeWidth="1.5" markerEnd="url(#arrowBlue)" />
        </g>

        {/* Ca2+ in - Phase 2 */}
        <g>
          <rect x="235" y="25" width="55" height="22" fill="white" stroke="#64748b" strokeWidth="1" rx="2" />
          <text x="262" y="40" fontSize="10" fill="#1f2937" textAnchor="middle">Ca²⁺ (in)</text>
          <line x1="262" y1="47" x2="240" y2="68" stroke="#1e40af" strokeWidth="1.5" markerEnd="url(#arrowBlue)" />
        </g>

        {/* K+ out - Phase 3 */}
        <g>
          <rect x="355" y="115" width="50" height="22" fill="white" stroke="#64748b" strokeWidth="1" rx="2" />
          <text x="380" y="130" fontSize="10" fill="#1f2937" textAnchor="middle">K⁺ (out)</text>
          <line x1="355" y1="126" x2="335" y2="150" stroke="#1e40af" strokeWidth="1.5" markerEnd="url(#arrowBlue)" />
        </g>

        {/* K+ rectifier - Phase 4 */}
        <g>
          <rect x="355" y="195" width="65" height="22" fill="white" stroke="#64748b" strokeWidth="1" rx="2" />
          <text x="387" y="210" fontSize="10" fill="#1f2937" textAnchor="middle">K⁺ (rectifier)</text>
          <line x1="355" y1="206" x2="345" y2="220" stroke="#1e40af" strokeWidth="1.5" markerEnd="url(#arrowBlue)" />
        </g>

        {/* Arrow marker definition */}
        <defs>
          <marker id="arrowBlue" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#1e40af" />
          </marker>
        </defs>

        {/* ECG below - simplified */}
        <g transform="translate(0, 270)">
          <line x1="50" y1="40" x2="450" y2="40" stroke="#fca5a5" strokeWidth="1" />
          <path
            d="M 50 40 L 150 40 L 160 35 L 170 40 L 200 40 L 210 45 L 215 -20 L 220 55 L 225 40 L 280 40 L 300 30 L 330 40 L 400 40 L 450 40"
            fill="none"
            stroke="#dc2626"
            strokeWidth="2"
          />
          <text x="250" y="70" fontSize="10" fill="#64748b" textAnchor="middle">ECG Correlation</text>
        </g>
      </svg>
    );
  };

  // Drug class box component for overview
  const DrugClassBox = ({ classKey, classData, position }) => {
    const isSelected = selectedClass === classKey;
    
    return (
      <div 
        className={`absolute bg-white border-2 rounded-lg p-2 shadow-lg cursor-pointer transition-all hover:scale-105 ${
          isSelected ? 'ring-2 ring-offset-2' : ''
        }`}
        style={{ 
          ...position, 
          borderColor: classData.color,
          ringColor: classData.color
        }}
        onClick={() => setSelectedClass(classKey)}
      >
        <div className="font-bold text-sm" style={{ color: classData.color }}>{classData.name}</div>
        <div className="text-xs text-gray-600 font-medium">{classData.subtitle}</div>
        {classData.subclasses ? (
          <div className="text-xs text-gray-500 mt-1">
            {Object.keys(classData.subclasses).map(sub => (
              <span key={sub} className="mr-1">{sub}</span>
            ))}
          </div>
        ) : classData.drugs && (
          <div className="text-xs text-gray-500 mt-1">
            {classData.drugs.slice(0, 2).map(d => d.name).join(', ')}
          </div>
        )}
      </div>
    );
  };

  // Render drug details
  const renderDrugDetails = () => {
    const classData = drugClasses[selectedClass];
    
    if (selectedClass === 'overview') {
      return (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-lg p-4">
            <h3 className="text-lg font-bold text-gray-800 mb-3">Vaughan-Williams Classification</h3>
            <p className="text-sm text-gray-600 mb-4">
              The Vaughan-Williams classification organizes antiarrhythmic drugs by their primary mechanism of action on cardiac ion channels and receptors. Understanding where each class acts on the action potential is key to predicting their effects.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {['classI', 'classII', 'classIII', 'classIV'].map(key => (
                <button
                  key={key}
                  onClick={() => setSelectedClass(key)}
                  className="p-3 rounded-lg border-2 hover:shadow-md transition-all text-left"
                  style={{ borderColor: drugClasses[key].color }}
                >
                  <div className="font-bold" style={{ color: drugClasses[key].color }}>
                    {drugClasses[key].name}
                  </div>
                  <div className="text-xs text-gray-600">{drugClasses[key].subtitle}</div>
                </button>
              ))}
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-4">
            <h3 className="text-lg font-bold text-gray-800 mb-3">Quick Reference</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2">
                    <th className="text-left py-2 px-2">Class</th>
                    <th className="text-left py-2 px-2">Target</th>
                    <th className="text-left py-2 px-2">Phase</th>
                    <th className="text-left py-2 px-2">ECG Effect</th>
                    <th className="text-left py-2 px-2">Key Drugs</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 px-2 font-semibold text-red-600">I</td>
                    <td className="py-2 px-2">Na⁺ channels</td>
                    <td className="py-2 px-2">0</td>
                    <td className="py-2 px-2">↑ QRS</td>
                    <td className="py-2 px-2">Flecainide, Lidocaine</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-2 font-semibold text-blue-600">II</td>
                    <td className="py-2 px-2">β-receptors</td>
                    <td className="py-2 px-2">4</td>
                    <td className="py-2 px-2">↓ HR, ↑ PR</td>
                    <td className="py-2 px-2">Metoprolol, Esmolol</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-2 font-semibold text-purple-600">III</td>
                    <td className="py-2 px-2">K⁺ channels</td>
                    <td className="py-2 px-2">3</td>
                    <td className="py-2 px-2">↑ QT</td>
                    <td className="py-2 px-2">Amiodarone, Sotalol</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-2 font-semibold text-green-600">IV</td>
                    <td className="py-2 px-2">Ca²⁺ channels</td>
                    <td className="py-2 px-2">2</td>
                    <td className="py-2 px-2">↓ HR, ↑ PR</td>
                    <td className="py-2 px-2">Verapamil, Diltiazem</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    if (selectedClass === 'other') {
      return (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-lg p-4">
            <h3 className="text-lg font-bold text-amber-600 mb-3">{classData.name}: {classData.subtitle}</h3>
            <p className="text-sm text-gray-600 mb-4">
              These agents don't fit neatly into the Vaughan-Williams classification but are important antiarrhythmic drugs.
            </p>
          </div>
          
          {classData.drugs.map((drug, idx) => (
            <div key={idx} className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-amber-500">
              <h4 className="font-bold text-lg text-gray-800">{drug.name}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <div className="bg-amber-50 p-3 rounded-lg">
                  <span className="text-xs font-semibold text-amber-700 uppercase">Mechanism</span>
                  <p className="text-sm text-gray-700 mt-1">{drug.mechanism}</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <span className="text-xs font-semibold text-blue-700 uppercase">Effect</span>
                  <p className="text-sm text-gray-700 mt-1">{drug.effect}</p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <span className="text-xs font-semibold text-green-700 uppercase">Clinical Use</span>
                  <p className="text-sm text-gray-700 mt-1">{drug.use}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <span className="text-xs font-semibold text-gray-700 uppercase">Notes</span>
                  <p className="text-sm text-gray-700 mt-1">{drug.notes}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Class I with subclasses
    if (selectedClass === 'classI') {
      return (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-lg p-4 border-l-4" style={{ borderColor: classData.color }}>
            <h3 className="text-lg font-bold" style={{ color: classData.color }}>
              {classData.name}: {classData.subtitle}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div className="bg-red-50 p-3 rounded-lg">
                <span className="text-xs font-semibold text-red-700 uppercase">Target</span>
                <p className="text-sm text-gray-700 mt-1">Phase {classData.phase} • {classData.ionCurrent}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <span className="text-xs font-semibold text-blue-700 uppercase">Mechanism</span>
                <p className="text-sm text-gray-700 mt-1">{classData.mechanism}</p>
              </div>
            </div>
          </div>

          {/* Subclass tabs */}
          <div className="flex gap-2">
            {Object.entries(classData.subclasses).map(([key, sub]) => (
              <button
                key={key}
                onClick={() => setSelectedSubclass(selectedSubclass === key ? null : key)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedSubclass === key
                    ? 'bg-red-600 text-white'
                    : 'bg-red-100 text-red-800 hover:bg-red-200'
                }`}
              >
                Class {key}
              </button>
            ))}
          </div>

          {/* Subclass details */}
          {selectedSubclass && classData.subclasses[selectedSubclass] && (
            <div className="bg-white rounded-xl shadow-lg p-4">
              <h4 className="font-bold text-lg text-red-700 mb-3">
                {classData.subclasses[selectedSubclass].name}
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div className="bg-red-50 p-3 rounded-lg">
                  <span className="text-xs font-semibold text-red-700">Block Strength</span>
                  <p className="text-sm font-medium mt-1">{classData.subclasses[selectedSubclass].blockStrength}</p>
                </div>
                <div className="bg-amber-50 p-3 rounded-lg">
                  <span className="text-xs font-semibold text-amber-700">Additional Effect</span>
                  <p className="text-sm mt-1">{classData.subclasses[selectedSubclass].additionalEffect}</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <span className="text-xs font-semibold text-blue-700">ECG Effect</span>
                  <p className="text-sm font-medium mt-1">{classData.subclasses[selectedSubclass].ecgEffect}</p>
                </div>
              </div>

              <div className="mb-4">
                <span className="text-sm font-semibold text-gray-700">Drugs:</span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                  {classData.subclasses[selectedSubclass].drugs.map((drug, idx) => (
                    <div key={idx} className="bg-gray-50 p-3 rounded-lg">
                      <div className="font-semibold text-gray-800">{drug.name}</div>
                      <div className="text-xs text-gray-600 mt-1">{drug.notes}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-green-50 p-3 rounded-lg">
                  <span className="text-xs font-semibold text-green-700">Clinical Uses</span>
                  <p className="text-sm mt-1">{classData.subclasses[selectedSubclass].uses}</p>
                </div>
                <div className="bg-orange-50 p-3 rounded-lg">
                  <span className="text-xs font-semibold text-orange-700">Side Effects</span>
                  <p className="text-sm mt-1">{classData.subclasses[selectedSubclass].sideEffects}</p>
                </div>
              </div>

              {classData.subclasses[selectedSubclass].warning && (
                <div className="mt-3 bg-red-100 border-l-4 border-red-500 p-3 rounded-r-lg">
                  <span className="text-sm font-bold text-red-700">⚠️ WARNING: </span>
                  <span className="text-sm text-red-800">{classData.subclasses[selectedSubclass].warning}</span>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    // Classes II, III, IV
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl shadow-lg p-4 border-l-4" style={{ borderColor: classData.color }}>
          <h3 className="text-lg font-bold" style={{ color: classData.color }}>
            {classData.name}: {classData.subtitle}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <div className="p-3 rounded-lg" style={{ backgroundColor: `${classData.color}15` }}>
              <span className="text-xs font-semibold uppercase" style={{ color: classData.color }}>Target</span>
              <p className="text-sm text-gray-700 mt-1 font-medium">Phase {classData.phase} • {classData.ionCurrent}</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <span className="text-xs font-semibold text-blue-700 uppercase">ECG Effect</span>
              <p className="text-sm text-gray-700 mt-1">{classData.ecgEffect}</p>
            </div>
          </div>

          <div className="mt-3 bg-gray-50 p-3 rounded-lg">
            <span className="text-xs font-semibold text-gray-700 uppercase">Mechanism of Action</span>
            <p className="text-sm text-gray-700 mt-1">{classData.mechanism}</p>
          </div>

          <div className="mt-3 bg-indigo-50 p-3 rounded-lg">
            <span className="text-xs font-semibold text-indigo-700 uppercase">Effect on Action Potential</span>
            <p className="text-sm text-gray-700 mt-1">{classData.effectOnAP}</p>
          </div>
        </div>

        {/* Drugs */}
        <div className="bg-white rounded-xl shadow-lg p-4">
          <h4 className="font-bold text-gray-800 mb-3">Drugs in This Class</h4>
          <div className="space-y-2">
            {classData.drugs.map((drug, idx) => (
              <div key={idx} className="bg-gray-50 p-3 rounded-lg border-l-4" style={{ borderColor: classData.color }}>
                <div className="font-semibold text-gray-800">{drug.name}</div>
                <div className="text-sm text-gray-600 mt-1">{drug.notes}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Clinical info */}
        <div className="bg-white rounded-xl shadow-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-green-50 p-3 rounded-lg">
              <span className="text-xs font-semibold text-green-700 uppercase">Clinical Uses</span>
              <p className="text-sm text-gray-700 mt-1">{classData.clinicalUse}</p>
            </div>
            <div className="bg-orange-50 p-3 rounded-lg">
              <span className="text-xs font-semibold text-orange-700 uppercase">Side Effects</span>
              <p className="text-sm text-gray-700 mt-1">{classData.sideEffects}</p>
            </div>
            {classData.contraindications && (
              <div className="md:col-span-2 bg-red-50 p-3 rounded-lg">
                <span className="text-xs font-semibold text-red-700 uppercase">Contraindications</span>
                <p className="text-sm text-gray-700 mt-1">{classData.contraindications}</p>
              </div>
            )}
            {classData.keyPoint && (
              <div className="md:col-span-2 bg-amber-50 border-l-4 border-amber-500 p-3 rounded-r-lg">
                <span className="text-sm font-bold text-amber-700">💡 Key Point: </span>
                <span className="text-sm text-amber-800">{classData.keyPoint}</span>
              </div>
            )}
            {classData.notIncluded && (
              <div className="md:col-span-2 bg-gray-100 p-3 rounded-lg">
                <span className="text-xs font-semibold text-gray-700 uppercase">Note</span>
                <p className="text-sm text-gray-600 mt-1">{classData.notIncluded}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Get highlight phase for current selection
  const getHighlightPhase = () => {
    if (selectedClass === 'classI') return 0;
    if (selectedClass === 'classII') return 4;
    if (selectedClass === 'classIII') return 3;
    if (selectedClass === 'classIV') return 2;
    return null;
  };

  const getHighlightColor = () => {
    if (selectedClass && drugClasses[selectedClass]) {
      return drugClasses[selectedClass].color;
    }
    return '#6b7280';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-800 to-purple-700 text-white py-5 px-4 shadow-lg">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold">Antiarrhythmic Drugs</h1>
          <p className="text-indigo-200 mt-1">Interactive Guide to the Vaughan-Williams Classification</p>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white shadow-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex overflow-x-auto">
          {Object.entries(drugClasses).map(([key, data]) => (
            <button
              key={key}
              onClick={() => { setSelectedClass(key); setSelectedSubclass(null); }}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                selectedClass === key
                  ? 'border-b-2 bg-opacity-10'
                  : 'border-transparent text-gray-600 hover:bg-gray-50'
              }`}
              style={{
                borderColor: selectedClass === key ? data.color : 'transparent',
                color: selectedClass === key ? data.color : undefined,
                backgroundColor: selectedClass === key ? `${data.color}10` : undefined
              }}
            >
              <div className="font-semibold">{data.name}</div>
              <div className="text-xs opacity-75">{data.subtitle.split(' ').slice(0, 2).join(' ')}</div>
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Left - Action Potential Diagram */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-lg p-4">
              <h3 className="text-lg font-bold text-gray-800 mb-2">Cardiac Action Potential</h3>
              <p className="text-sm text-gray-600 mb-3">
                {selectedClass !== 'overview' && selectedClass !== 'other' 
                  ? `${drugClasses[selectedClass].name} drugs act on Phase ${drugClasses[selectedClass].phase}`
                  : 'Select a drug class to see where it acts on the action potential'}
              </p>
              <ActionPotential 
                highlightPhase={getHighlightPhase()} 
                highlightColor={getHighlightColor()}
              />
            </div>

            {/* Phase Summary Card */}
            <div className="bg-white rounded-xl shadow-lg p-4">
              <h4 className="font-bold text-gray-800 mb-3">Action Potential Phases</h4>
              <div className="space-y-2 text-sm">
                <div className={`p-2 rounded-lg ${selectedClass === 'classI' ? 'bg-red-100 ring-2 ring-red-500' : 'bg-gray-50'}`}>
                  <span className="font-bold">Phase 0:</span> Rapid depolarization (Na⁺ influx) — <span className="text-red-600 font-medium">Class I target</span>
                </div>
                <div className={`p-2 rounded-lg bg-gray-50`}>
                  <span className="font-bold">Phase 1:</span> Early repolarization (K⁺/Cl⁻ efflux)
                </div>
                <div className={`p-2 rounded-lg ${selectedClass === 'classIV' ? 'bg-green-100 ring-2 ring-green-500' : 'bg-gray-50'}`}>
                  <span className="font-bold">Phase 2:</span> Plateau (Ca²⁺ influx balances K⁺ efflux) — <span className="text-green-600 font-medium">Class IV target</span>
                </div>
                <div className={`p-2 rounded-lg ${selectedClass === 'classIII' ? 'bg-purple-100 ring-2 ring-purple-500' : 'bg-gray-50'}`}>
                  <span className="font-bold">Phase 3:</span> Repolarization (K⁺ efflux) — <span className="text-purple-600 font-medium">Class III target</span>
                </div>
                <div className={`p-2 rounded-lg ${selectedClass === 'classII' ? 'bg-blue-100 ring-2 ring-blue-500' : 'bg-gray-50'}`}>
                  <span className="font-bold">Phase 4:</span> Resting / Pacemaker potential — <span className="text-blue-600 font-medium">Class II target</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right - Drug Details */}
          <div>
            {renderDrugDetails()}
          </div>
        </div>

        {/* High-Yield Clinical Pearls */}
        <div className="mt-6 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl shadow-lg p-4">
          <h3 className="text-lg font-bold text-amber-800 mb-3">💡 High-Yield Clinical Pearls</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="bg-white p-3 rounded-lg">
              <span className="font-semibold text-amber-700">Amiodarone</span>
              <p className="text-xs text-gray-600 mt-1">Has effects of ALL 4 classes. Most effective but most toxic. Think "Pulmonary fibrosis, Thyroid, Hepatotoxicity, Optic neuropathy, Skin (blue-gray)"</p>
            </div>
            <div className="bg-white p-3 rounded-lg">
              <span className="font-semibold text-amber-700">Class Ic Warning</span>
              <p className="text-xs text-gray-600 mt-1">CAST trial: Flecainide/encainide increased mortality post-MI. Never use in structural heart disease!</p>
            </div>
            <div className="bg-white p-3 rounded-lg">
              <span className="font-semibold text-amber-700">WPW + AF</span>
              <p className="text-xs text-gray-600 mt-1">Avoid AV nodal blockers (β-blockers, CCB, adenosine, digoxin) — can accelerate accessory pathway → VF. Use procainamide or ibutilide.</p>
            </div>
            <div className="bg-white p-3 rounded-lg">
              <span className="font-semibold text-amber-700">Torsades Treatment</span>
              <p className="text-xs text-gray-600 mt-1">IV Magnesium is first-line (even with normal Mg levels). Also: stop offending drug, correct K⁺, overdrive pacing.</p>
            </div>
            <div className="bg-white p-3 rounded-lg">
              <span className="font-semibold text-amber-700">Adenosine Pearls</span>
              <p className="text-xs text-gray-600 mt-1">Give rapid IV push with immediate flush. Theophylline/caffeine blocks effect. Dipyridamole potentiates (use lower dose).</p>
            </div>
            <div className="bg-white p-3 rounded-lg">
              <span className="font-semibold text-amber-700">Sotalol = II + III</span>
              <p className="text-xs text-gray-600 mt-1">Has both β-blocking (Class II) and K⁺ blocking (Class III) activity. Renally cleared — adjust for eGFR!</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AntiarrhythmicsTool;
