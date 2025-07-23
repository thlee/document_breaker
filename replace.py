from default_api import default_api

# .chat-sidebar 스타일 블록 뒤에 .chat-header 스타일 삽입
print(default_api.replace(file_path = "C:/work/document_breaker/assets/css/style.css", new_string = """/* Chat Sidebar Styles */
.chat-sidebar {
    grid-column: 2 / 4;
    grid-row: 3 / 11;
    background: rgba(0, 0, 0, 0.9);
    border: 3px solid #333;
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative; /* 추가 */
}

.chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 15px;
    background: rgba(0, 0, 0, 0.8);
    border-bottom: 1px solid #444;
    border-top-left-radius: 10px;
    border-top-right-radius: 10px;
}

.chat-header h3 {
    margin: 0;
    color: #FFD700; /* 랭킹 제목과 동일한 색상 */
    font-size: 18px;
}

.chat-header #refreshChatButton {
    margin-left: auto; /* 오른쪽으로 밀어내기 */
    padding: 5px 10px; /* 버튼 크기 조정 */
    font-size: 18px; /* 이모지 크기 조정 */
    background: none; /* 배경 제거 */
    border: none; /* 테두리 제거 */
    color: white; /* 색상 */
    cursor: pointer;
    transition: transform 0.2s;
}

.chat-header #refreshChatButton:hover {
    transform: scale(1.1);
}

.chat-header #refreshChatButton:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}""", old_string = """/* Chat Sidebar Styles */
.chat-sidebar {
    grid-column: 2 / 4;
    grid-row: 3 / 11;
    background: rgba(0, 0, 0, 0.9);
    border: 3px solid #333;
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative; /* 추가 */
}"""))
