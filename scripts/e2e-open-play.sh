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
# 18. rate limit: burst enrolls (already used 2 of 30 this minute)
LAST=200
for i in $(seq 1 31); do LAST=$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/api/beta/enroll -H "$J" -d '{"code":""}'); done
chk "enrollment rate limit 503" 503 $LAST
echo "=== PASS=$pass FAIL=$fail"
