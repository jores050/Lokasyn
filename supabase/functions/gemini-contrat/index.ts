// ================================================================
// LocaSyn — gemini-contrat/index.ts
// Génération de contrat de bail OHADA via Gemini 1.5 Flash
// ================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let body: { bail_id: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { bail_id } = body;
  if (!bail_id) {
    return new Response(JSON.stringify({ error: "bail_id requis" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Charger le bail avec toutes les infos
  const { data: bail, error } = await supabase
    .from("baux")
    .select(`
      *,
      logements(titre, quartier, ville, adresse_complete, surface_m2, type, equipements),
      bailleur:profiles!bailleur_id(nom, prenom, telephone, ville, quartier, ifu),
      locataire:profiles!locataire_id(nom, prenom, telephone, ville, quartier)
    `)
    .eq("id", bail_id)
    .single();

  if (error || !bail) {
    return new Response(JSON.stringify({ error: "Bail introuvable" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const typeBailLabel: Record<string, string> = {
    mensuel: "à durée indéterminée, révisable mensuellement",
    annuel: "d'une durée d'un (1) an renouvelable",
    etudiant: "étudiant d'une durée d'un (1) an académique",
    court_terme: "à courte durée (moins de 6 mois)",
  };

  const prompt = `Tu es un juriste spécialisé en droit immobilier béninois et OHADA.
Génère un contrat de bail d'habitation complet, formel et juridiquement valide selon le droit béninois et les dispositions de l'Acte Uniforme OHADA relatif au bail à usage d'habitation.

PARTIES :
- BAILLEUR : ${bail.bailleur?.prenom} ${bail.bailleur?.nom}, demeurant à ${bail.bailleur?.quartier || ''}, ${bail.bailleur?.ville || 'Cotonou'}, Bénin${bail.bailleur?.telephone ? `, Tél : ${bail.bailleur.telephone}` : ''}${bail.bailleur?.ifu ? `, IFU : ${bail.bailleur.ifu}` : ''}
- PRENEUR (LOCATAIRE) : ${bail.locataire?.prenom} ${bail.locataire?.nom}, demeurant à ${bail.locataire?.quartier || ''}, ${bail.locataire?.ville || 'Cotonou'}, Bénin${bail.locataire?.telephone ? `, Tél : ${bail.locataire.telephone}` : ''}

BIEN LOUÉ :
- Type : ${bail.logements?.type || 'appartement'} — ${bail.logements?.titre || ''}
- Localisation : ${bail.logements?.quartier}, ${bail.logements?.ville || 'Cotonou'}, Bénin${bail.logements?.adresse_complete ? ` (${bail.logements.adresse_complete})` : ''}
${bail.logements?.surface_m2 ? `- Surface : ${bail.logements.surface_m2} m²` : ''}
${bail.logements?.equipements?.length ? `- Équipements : ${bail.logements.equipements.join(', ')}` : ''}

CONDITIONS FINANCIÈRES :
- Loyer mensuel : ${bail.loyer_mensuel.toLocaleString('fr-FR')} FCFA (${bail.loyer_mensuel.toLocaleString('fr-FR')} Francs CFA)
- Caution : ${bail.caution_montant.toLocaleString('fr-FR')} FCFA
- Date de début : ${bail.date_debut}
${bail.date_fin ? `- Date de fin : ${bail.date_fin}` : ''}
- Type de bail : ${typeBailLabel[bail.type_bail] || bail.type_bail}
${bail.conditions_particulieres ? `\nCONDITIONS PARTICULIÈRES :\n${bail.conditions_particulieres}` : ''}

Génère un contrat complet avec :
1. En-tête formel (ville, date, référence)
2. Identification des parties
3. Désignation des locaux
4. Durée du bail
5. Conditions financières (loyer, caution, modalités de paiement, révision)
6. Obligations du bailleur
7. Obligations du locataire
8. Conditions de résiliation
9. Clause de médiation / règlement des litiges (tribunal compétent de Cotonou)
10. Signatures (espaces prévus pour les deux parties + témoins)

Le contrat doit être rédigé en français formel, utiliser les références légales béninoises appropriées, et être immédiatement utilisable. Ne pas utiliser de placeholders — remplir tous les champs avec les informations fournies.`;

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY non configurée" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      throw new Error(`Gemini API error: ${err}`);
    }

    const result = await geminiRes.json();
    const contrat = result?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!contrat) {
      throw new Error("Gemini n'a pas retourné de contenu");
    }

    // Marquer le bail comme ayant un contrat généré par IA
    await supabase.from("baux").update({ contrat_genere_ia: true }).eq("id", bail_id);

    return new Response(JSON.stringify({ ok: true, contrat }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Gemini error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
