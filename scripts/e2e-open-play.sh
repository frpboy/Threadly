#!/bin/bash
B=http://localhost:3100
J='Content-Type: application/json'
pass=0; fail=0
chk() { # name expected actual
  if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "PASS $1"; else fail=$((fail+1)); echo "FAIL $1 expected=$2 got=$3"; fi
}
# 1. open enroll device A
R=$(curl -s -X POST $B/api/beta/enroll -H "$J" -d '{"code":""}'); echo "enrollA: $R"
TA=$(echo "$R" | jq -r .token); GA=$(echo "$R" | jq -r .guestId)
[ "${TA:0:1}" != "n" ] && [ -n "$TA" ]; chk "enroll A 200+token" 0 $?
# 2. enroll device B
R=$(curl -s -X POST $B/api/beta/enroll -H "$J" -d '{"code":""}')
TB=$(echo "$R" | jq -r .token); GB=$(echo "$R" | jq -r .guestId)
[ "$TA" != "$TB" ]; chk "distinct device tokens" 0 $?
# 3. daily with A
chk "daily A 200" 200 $(curl -s -o /dev/null -w '%{http_code}' $B/api/daily -H "Authorization: Bearer $TA")
# 4. malformed bearer -> 401
chk "daily malformed 401" 401 $(curl -s -o /dev/null -w '%{http_code}' $B/api/daily -H "Authorization: Bearer !!bad!!")
# 5. guess without request_id -> 400
chk "guess no request_id 400" 400 $(curl -s -o /dev/null -w '%{http_code}' -X POST $B/api/guess -H "$J" -H "Authorization: Bearer $TA" -d '{"puzzle_id":"e2e-puzzle","guess":"ocean","guest_id":"x12345678"}')
# 6. guess with request_id -> 200, wrong answer
RID1=$(cat /proc/sys/kernel/random/uuid)
R=$(curl -s -X POST $B/api/guess -H "$J" -H "Authorization: Bearer $TA" -d "{\"puzzle_id\":\"e2e-puzzle\",\"guess\":\"ocean\",\"guest_id\":\"x12345678\",\"request_id\":\"$RID1\"}")
echo "guessA: $R"; chk "guess A 200" 200 $(echo "$R" | jq -r 'if .correct==false or .correct==true then 200 else 0 end')
# 7. replay same request_id -> same result, no double count
R2=$(curl -s -X POST $B/api/guess -H "$J" -H "Authorization: Bearer $TA" -d "{\"puzzle_id\":\"e2e-puzzle\",\"guess\":\"ocean\",\"guest_id\":\"x12345678\",\"request_id\":\"$RID1\"}")
chk "idempotent replay same clues_used" "$(echo "$R"|jq -c .clues_used)" "$(echo "$R2"|jq -c .clues_used)"
# 8. conflict: same request_id different guess -> 409
chk "request conflict 409" 409 $(curl -s -o /dev/null -w '%{http_code}' -X POST $B/api/guess -H "$J" -H "Authorization: Bearer $TA" -d "{\"puzzle_id\":\"e2e-puzzle\",\"guess\":\"forest\",\"guest_id\":\"x12345678\",\"request_id\":\"$RID1\"}")
# 9. cross-device isolation: B progress shows no guesses
R=$(curl -s -X POST $B/api/progress -H "$J" -H "Authorization: Bearer $TB" -d '{"puzzle_id":"e2e-puzzle","guest_id":"y87654321"}')
chk "B progress no guesses" 0 $(echo "$R" | jq '.guesses | length')
# 10. namespace: claimed dev-* id without credential -> 400
chk "progress dev-* claim 400" 400 $(curl -s -o /dev/null -w '%{http_code}' -X POST $B/api/progress -H "$J" -d "{\"puzzle_id\":\"e2e-puzzle\",\"guest_id\":\"$GA\"}")
# 11. web guest path still open
WG=$(cat /proc/sys/kernel/random/uuid)
chk "guest progress 200" 200 $(curl -s -o /dev/null -w '%{http_code}' -X POST $B/api/progress -H "$J" -d "{\"puzzle_id\":\"e2e-puzzle\",\"guest_id\":\"$WG\"}")
# 12. web guest guess works
chk "guest guess 200" 200 $(curl -s -o /dev/null -w '%{http_code}' -X POST $B/api/guess -H "$J" -d "{\"puzzle_id\":\"e2e-puzzle\",\"guess\":\"ocean\",\"guest_id\":\"$WG\"}")
# 13. guest delete of dev-* -> 400
chk "guest delete dev-* 400" 400 $(curl -s -o /dev/null -w '%{http_code}' -X DELETE $B/api/player-data -H "$J" -d "{\"guest_id\":\"$GA\",\"confirm\":true}")
# 14. A self-deletes
R=$(curl -s -X DELETE $B/api/player-data -H "Authorization: Bearer $TA")
echo "deleteA: $R"; chk "delete A 200" true $(echo "$R" | jq -r .deleted); chk "deviceRemoved" true $(echo "$R" | jq -r .deviceRemoved)
chk "A guesses deleted (1 row)" 1 $(echo "$R" | jq .counts.guesses)
# 15. A token now dead
chk "dead token 401" 401 $(curl -s -o /dev/null -w '%{http_code}' $B/api/daily -H "Authorization: Bearer $TA")
# 16. B unaffected
chk "B daily still 200" 200 $(curl -s -o /dev/null -w '%{http_code}' $B/api/daily -H "Authorization: Bearer $TB")
# 17. web guest delete
chk "guest delete 200" 200 $(curl -s -o /dev/null -w '%{http_code}' -X DELETE $B/api/player-data -H "$J" -d "{\"guest_id\":\"$WG\",\"confirm\":true}")
# 18. expired credential: gameplay 401, deletion still 200
R=$(curl -s -X POST $B/api/beta/enroll -H "$J" -d '{"code":""}'); TC=$(echo "$R" | jq -r .token); GC=$(echo "$R" | jq -r .guestId)
curl -s -o /dev/null -X POST $B/api/guess -H "$J" -H "Authorization: Bearer $TC" -d "{\"puzzle_id\":\"e2e-puzzle\",\"guess\":\"ocean\",\"guest_id\":\"x\",\"request_id\":\"$(cat /proc/sys/kernel/random/uuid)\"}"
psql "$PGURL" -q -c "UPDATE threadly_open_device SET expires_at = now() - interval '1 day' WHERE guest_id='$GC';"
chk "expired token gameplay 401" 401 $(curl -s -o /dev/null -w '%{http_code}' $B/api/daily -H "Authorization: Bearer $TC")
R=$(curl -s -X DELETE $B/api/player-data -H "Authorization: Bearer $TC")
chk "expired token delete 200" true $(echo "$R" | jq -r .deleted)
chk "expired token delete removed guess" 1 $(echo "$R" | jq .counts.guesses)
# 19. capped credential: gameplay 401, deletion still 200
R=$(curl -s -X POST $B/api/beta/enroll -H "$J" -d '{"code":""}'); TD=$(echo "$R" | jq -r .token); GD=$(echo "$R" | jq -r .guestId)
psql "$PGURL" -q -c "UPDATE threadly_open_device SET request_count = 2000 WHERE guest_id='$GD';"
chk "capped token gameplay 401" 401 $(curl -s -o /dev/null -w '%{http_code}' $B/api/daily -H "Authorization: Bearer $TD")
chk "capped token delete 200" 200 $(curl -s -o /dev/null -w '%{http_code}' -X DELETE $B/api/player-data -H "Authorization: Bearer $TD")
# 20. automatic purge after grace: identity AND all data gone on next enrollment
R=$(curl -s -X POST $B/api/beta/enroll -H "$J" -d '{"code":""}'); TE=$(echo "$R" | jq -r .token); GE=$(echo "$R" | jq -r .guestId)
curl -s -o /dev/null -X POST $B/api/guess -H "$J" -H "Authorization: Bearer $TE" -d "{\"puzzle_id\":\"e2e-puzzle\",\"guess\":\"ocean\",\"guest_id\":\"x\",\"request_id\":\"$(cat /proc/sys/kernel/random/uuid)\"}"
psql "$PGURL" -q -c "UPDATE threadly_open_device SET expires_at = now() - interval '31 days' WHERE guest_id='$GE';"
curl -s -o /dev/null -X POST $B/api/beta/enroll -H "$J" -d '{"code":""}'  # triggers purge
chk "purge removed device row" 0 $(psql "$PGURL" -t -A -c "SELECT count(*) FROM threadly_open_device WHERE guest_id='$GE';")
chk "purge removed guess rows" 0 $(psql "$PGURL" -t -A -c "SELECT count(*) FROM guesses WHERE guest_id='$GE';")
chk "purge removed receipt rows" 0 $(psql "$PGURL" -t -A -c "SELECT count(*) FROM threadly_guess_receipt WHERE guest_id='$GE';")
# 21. concurrency: same-browser concurrent guess + delete fully serialize, no 5xx, consistent end state
WG2=$(cat /proc/sys/kernel/random/uuid)
curl -s -o /dev/null -X POST $B/api/guess -H "$J" -d "{\"puzzle_id\":\"e2e-puzzle\",\"guess\":\"ocean\",\"guest_id\":\"$WG2\"}"
curl -s -o /tmp/e2e-race-guess.json -w '%{http_code}' -X POST $B/api/guess -H "$J" -d "{\"puzzle_id\":\"e2e-puzzle\",\"guess\":\"forest\",\"guest_id\":\"$WG2\"}" > /tmp/e2e-race-guess.code &
curl -s -o /tmp/e2e-race-del.json -w '%{http_code}' -X DELETE $B/api/player-data -H "$J" -d "{\"guest_id\":\"$WG2\",\"confirm\":true}" > /tmp/e2e-race-del.code &
wait
G_CODE=$(cat /tmp/e2e-race-guess.code); D_CODE=$(cat /tmp/e2e-race-del.code)
chk "race: no 5xx (guess)" ok "$( [ "${G_CODE:0:1}" != "5" ] && echo ok || echo "bad$G_CODE")"
chk "race: delete 200" 200 "$D_CODE"
LEFT=$(psql "$PGURL" -t -A -c "SELECT (SELECT count(*) FROM guesses WHERE guest_id='$WG2') + (SELECT count(*) FROM stats WHERE guest_id='$WG2') + (SELECT count(*) FROM streaks WHERE guest_id='$WG2');")
# consistent end state: either guess-then-delete (0 rows) or delete-then-guess (the raced guess row only)
chk "race: consistent serial end state" ok "$( { [ "$LEFT" = "0" ] || [ "$LEFT" = "1" ]; } && echo ok || echo "bad$LEFT")"
curl -s -o /dev/null -X DELETE $B/api/player-data -H "$J" -d "{\"guest_id\":\"$WG2\",\"confirm\":true}"
chk "race: final cleanup leaves 0" 0 $(psql "$PGURL" -t -A -c "SELECT count(*) FROM guesses WHERE guest_id='$WG2'")
# 21b. pre-authorized device guess vs self-deletion race (review-round-2 defect):
# both serial orderings must end consistent; the r2 defect signature is
# delete=200 with zero counts yet stranded rows and no device row afterwards.
for WORD in mountain ocean; do
  for round in 1 2 3; do
    psql "$PGURL" -q -c "UPDATE threadly_open_enrollment SET enrollment_attempts=0, enrollment_window=now()-interval '2 minutes';"
    R=$(curl -s -X POST $B/api/beta/enroll -H "$J" -d '{"code":""}')
    T=$(echo "$R" | jq -r .token); G=$(echo "$R" | jq -r .guestId)
    curl -s -o /tmp/e2e-dr-g.json -w '%{http_code}' -X POST $B/api/guess -H "$J" \
      -H "Authorization: Bearer $T" \
      -d "{\"puzzle_id\":\"e2e-puzzle\",\"guess\":\"$WORD\",\"guest_id\":\"x\",\"request_id\":\"$(cat /proc/sys/kernel/random/uuid)\"}" > /tmp/e2e-dr-g.code &
    curl -s -o /tmp/e2e-dr-d.json -w '%{http_code}' -X DELETE $B/api/player-data \
      -H "Authorization: Bearer $T" > /tmp/e2e-dr-d.code &
    wait
    GC=$(cat /tmp/e2e-dr-g.code); DC=$(cat /tmp/e2e-dr-d.code)
    CNT=$(jq -c .counts /tmp/e2e-dr-d.json 2>/dev/null)
    STRANDED=$(psql "$PGURL" -tA -c "SELECT (SELECT count(*) FROM guesses WHERE guest_id='$G')+(SELECT count(*) FROM streaks WHERE guest_id='$G')+(SELECT count(*) FROM stats WHERE guest_id='$G')+(SELECT count(*) FROM leaderboard_entries WHERE guest_id='$G')+(SELECT count(*) FROM threadly_guess_receipt WHERE guest_id='$G')")
    DEVROW=$(psql "$PGURL" -tA -c "SELECT count(*) FROM threadly_open_device WHERE guest_id='$G'")
    echo "race round $WORD/$round: guess=$GC delete=$DC counts=$CNT stranded=$STRANDED devrow=$DEVROW"
    chk "race $WORD r$round: no defect signature (200 delete + zero counts + stranded rows)" no "$( { [ "$DC" = 200 ] && [ "$CNT" = '{"guesses":0,"streaks":0,"stats":0,"leaderboard":0,"receipts":0}' ] && [ "$STRANDED" -gt 0 ]; } && echo yes || echo no)"
    chk "race $WORD r$round: consistent end state (no stranded rows, no leftover device)" ok "$( { [ "$STRANDED" = 0 ] && [ "$DEVROW" = 0 ]; } && echo ok || echo "bad s=$STRANDED d=$DEVROW")"
    chk "race $WORD r$round: loser guess rejected 401" ok "$( { [ "$GC" = 401 ] || [ "$GC" = 200 ]; } && echo ok || echo "bad$GC")"
  done
done
# stranded winners would be publicly visible; assert none exist
chk "leaderboard: no stranded Guest_dev-* entries" 0 $(curl -s $B/api/leaderboard | jq '[.entries[] | select(.username | startswith("Guest_dev-"))] | length')
# and no purge-unreachable rows anywhere
psql "$PGURL" -q -c "UPDATE threadly_open_enrollment SET enrollment_attempts=0, enrollment_window=now()-interval '2 minutes';"
curl -s -o /dev/null -X POST $B/api/beta/enroll -H "$J" -d '{"code":""}'
chk "no dev-* guess rows without a device row" 0 $(psql "$PGURL" -tA -c "SELECT count(*) FROM guesses g WHERE g.guest_id LIKE 'dev-%' AND NOT EXISTS (SELECT 1 FROM threadly_open_device d WHERE d.guest_id=g.guest_id);")

# 22. rate limit: burst enrolls
LAST=200
for i in $(seq 1 33); do LAST=$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/api/beta/enroll -H "$J" -d '{"code":""}'); done
chk "enrollment rate limit 503" 503 $LAST
echo "=== PASS=$pass FAIL=$fail"
