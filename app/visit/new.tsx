import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CandidateList } from "../../src/components/CandidateList";
import { MemoField } from "../../src/components/MemoField";
import { VisitDateField } from "../../src/components/VisitDateField";
import {
  findMunicipalityByCode,
  MUNICIPALITIES,
  type Municipality,
} from "../../src/data/municipalities";
import { useDictDb } from "../../src/db/DictDbProvider";
import {
  candidatePlaceName,
  searchCandidates,
  type Candidate,
  type SearchResult,
} from "../../src/db/dict-search";
import { addVisit, type NewVisit as VisitInput } from "../../src/db/visits";
import { toLocalDateString } from "../../src/lib/date";
import { normalizeName } from "../../src/lib/search-normalize";
import { useTheme } from "../../theme/use-theme";

// 訪問入力画面。場所を入力して駅・町域の候補から選ぶか、区市を直接選んで記録する。
// 区市が決まるまでは保存できない（区市未確定の下書きは持たない。Q15）。
export default function NewVisit() {
  const theme = useTheme();
  const router = useRouter();
  const db = useSQLiteContext();
  const dict = useDictDb();

  const [text, setText] = useState("");
  // 候補から選んで確定した駅・町域。入力を変えるか、区市を選び直すと外れる。
  const [selected, setSelected] = useState<Candidate | null>(null);
  // 一覧から直接選んだ区市。
  const [pickedMunicipality, setPickedMunicipality] =
    useState<Municipality | null>(null);
  // text に対する検索結果。結果が届くまでは前の入力のものが残るので、query で見分ける。
  const [search, setSearch] = useState<{
    query: string;
    result: SearchResult;
  } | null>(null);

  const [visitedOn, setVisitedOn] = useState(() =>
    toLocalDateString(new Date()),
  );
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  // state の更新は次の描画まで反映されないので、連打は ref で止める。
  const savingRef = useRef(false);

  const searching = selected === null && normalizeName(text) !== "";

  useEffect(() => {
    if (!dict || !searching) return;
    // 入力が進んだ後に届いた古い結果は捨てる。
    let active = true;
    searchCandidates(dict, text).then(
      (result) => {
        if (active) setSearch({ query: text, result });
      },
      () => {
        // 検索に失敗しても、区市の直接選択で記録できる。
      },
    );
    return () => {
      active = false;
    };
  }, [dict, text, searching]);

  const result = searching && search?.query === text ? search.result : null;

  const municipality = selected
    ? (findMunicipalityByCode(selected.municipalityCode) ?? null)
    : pickedMunicipality;

  const changeText = (value: string) => {
    setText(value);
    setSelected(null);
  };

  const selectCandidate = (candidate: Candidate) => {
    setSelected(candidate);
    setText(candidatePlaceName(candidate));
    setPickedMunicipality(null);
  };

  const pickMunicipality = (m: Municipality) => {
    // 区市を手で選び直したら、候補での確定は外して手動の入力として扱う。
    setSelected(null);
    setPickedMunicipality(m);
  };

  const buildVisit = (m: Municipality): VisitInput => {
    if (selected) {
      return {
        municipalityCode: m.code,
        visitedOn,
        memo,
        source: selected.source,
        placeName: candidatePlaceName(selected),
        refId: selected.id,
      };
    }
    const placeName = text.trim();
    return {
      municipalityCode: m.code,
      visitedOn,
      memo,
      source: "manual",
      // 区市だけを選んだときは、場所名に区市名を入れる（Q16）。
      placeName: placeName === "" ? m.name : placeName,
    };
  };

  const save = async () => {
    if (!municipality || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveFailed(false);
    try {
      await addVisit(db, buildVisit(municipality));
      router.back();
    } catch {
      // 失敗したときは知らせて、もう一度押せるようにする。
      savingRef.current = false;
      setSaving(false);
      setSaveFailed(true);
    }
  };

  const canSave = municipality !== null && !saving;

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.container, { backgroundColor: theme.background }]}
      testID="visit-new-screen"
    >
      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            場所（駅名・町域名・施設名など）
          </Text>
          <TextInput
            value={text}
            onChangeText={changeText}
            placeholder="例: 上野、にししんじゅく、東京ドーム"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="場所"
            style={[
              styles.field,
              { backgroundColor: theme.surface, color: theme.text },
            ]}
          />
        </View>

        {result && (
          <CandidateList result={result} onSelect={selectCandidate} />
        )}

        <View style={styles.form}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            区市
          </Text>
          <Text
            style={[
              styles.value,
              { color: municipality ? theme.text : theme.textSecondary },
            ]}
            testID="selected-municipality"
          >
            {municipality ? municipality.name : "下の一覧から選んでください"}
          </Text>

          <VisitDateField value={visitedOn} onChange={setVisitedOn} />
          <MemoField value={memo} onChangeText={setMemo} />

          <Text style={[styles.label, { color: theme.textSecondary }]}>
            区市から直接選ぶ
          </Text>
        </View>

        <View style={styles.list} testID="municipality-picker">
          {MUNICIPALITIES.map((m) => {
            const isSelected = m.code === municipality?.code;
            return (
              <Pressable
                key={m.code}
                role="radio"
                accessibilityState={{ selected: isSelected }}
                onPress={() => pickMunicipality(m)}
                style={[
                  styles.row,
                  { borderBottomColor: theme.border },
                  isSelected && { backgroundColor: theme.surface },
                ]}
              >
                <Text
                  style={[
                    styles.rowText,
                    { color: theme.text },
                    isSelected && styles.rowTextSelected,
                  ]}
                >
                  {m.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {saveFailed && (
        <Text role="alert" style={[styles.error, { color: theme.text }]}>
          保存できませんでした。もう一度お試しください。
        </Text>
      )}
      <Pressable
        role="button"
        onPress={save}
        disabled={!canSave}
        accessibilityState={{ disabled: !canSave }}
        style={[
          styles.saveButton,
          {
            backgroundColor: canSave ? theme.primary : theme.border,
          },
        ]}
      >
        <Text
          style={[
            styles.saveLabel,
            { color: canSave ? theme.onPrimary : theme.textSecondary },
          ]}
        >
          保存
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  form: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  label: {
    marginTop: 12,
    fontSize: 13,
  },
  field: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 16,
  },
  value: {
    marginTop: 4,
    fontSize: 16,
  },
  list: {
    marginTop: 8,
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    fontSize: 16,
  },
  rowTextSelected: {
    fontWeight: "bold",
  },
  error: {
    marginTop: 12,
    marginHorizontal: 16,
    fontSize: 14,
  },
  saveButton: {
    margin: 16,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  saveLabel: {
    fontSize: 16,
    fontWeight: "bold",
  },
});
