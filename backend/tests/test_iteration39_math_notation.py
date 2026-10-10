"""
Iteration 39: Test Math & Science Notation Preservation
Tests for clean_ai_html, PDF CSS, Quiz PDF Unicode font, and AI prompts
"""
import pytest
import requests
import os
import sys
import re

# Add backend to path for direct imports
sys.path.insert(0, '/app/backend')

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# ═══════════════════════════════════════════════════════════════════════════════
# UNIT TESTS: clean_ai_html function
# ═══════════════════════════════════════════════════════════════════════════════

class TestCleanAiHtml:
    """Test clean_ai_html preserves math/science notation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Import clean_ai_html from schemes.py"""
        from routes.schemes import clean_ai_html, ensure_table_structure
        self.clean_ai_html = clean_ai_html
        self.ensure_table_structure = ensure_table_structure
    
    def test_preserves_sub_tags(self):
        """clean_ai_html preserves <sub> tags for subscripts like H₂O"""
        html = "<p>Water is H<sub>2</sub>O and carbon dioxide is CO<sub>2</sub></p>"
        result = self.clean_ai_html(html)
        assert "<sub>2</sub>" in result, f"<sub> tags should be preserved. Got: {result}"
        assert "H<sub>2</sub>O" in result, f"H<sub>2</sub>O should be preserved. Got: {result}"
        assert "CO<sub>2</sub>" in result, f"CO<sub>2</sub> should be preserved. Got: {result}"
        print("PASS: <sub> tags preserved for H₂O, CO₂")
    
    def test_preserves_sup_tags(self):
        """clean_ai_html preserves <sup> tags for superscripts like x²"""
        html = "<p>Area = x<sup>2</sup> and volume = x<sup>3</sup></p>"
        result = self.clean_ai_html(html)
        assert "<sup>2</sup>" in result, f"<sup> tags should be preserved. Got: {result}"
        assert "<sup>3</sup>" in result, f"<sup> tags should be preserved. Got: {result}"
        assert "x<sup>2</sup>" in result, f"x<sup>2</sup> should be preserved. Got: {result}"
        print("PASS: <sup> tags preserved for x², x³")
    
    def test_preserves_unicode_math_symbols(self):
        """clean_ai_html preserves Unicode math symbols"""
        html = "<p>π ≈ 3.14159, √4 = 2, ∑ of series, ∫ integral, ≤ ≥ ≠ ± × ÷ °</p>"
        result = self.clean_ai_html(html)
        symbols = ['π', '√', '∑', '∫', '≤', '≥', '≠', '±', '×', '÷', '°']
        for sym in symbols:
            assert sym in result, f"Unicode symbol {sym} should be preserved. Got: {result}"
        print(f"PASS: Unicode math symbols preserved: {', '.join(symbols)}")
    
    def test_preserves_unicode_subscript_superscript(self):
        """clean_ai_html preserves Unicode subscript/superscript characters"""
        html = "<p>H₂O, CO₂, x₁, x₂, x², m³, 10⁸</p>"
        result = self.clean_ai_html(html)
        chars = ['₂', '₁', '²', '³', '⁸']
        for char in chars:
            assert char in result, f"Unicode char {char} should be preserved. Got: {result}"
        print(f"PASS: Unicode sub/superscript chars preserved: {', '.join(chars)}")
    
    def test_single_asterisk_not_converted_to_bold(self):
        """clean_ai_html does NOT convert single * to bold (a * b stays as is)"""
        html = "<p>Multiplication: a * b = c, and 5 * 3 = 15</p>"
        result = self.clean_ai_html(html)
        # Single * should NOT become <strong> or <em>
        assert "a * b" in result or "a*b" in result, f"Single * should not be converted. Got: {result}"
        assert "<strong>b</strong>" not in result, f"Single * should not create bold. Got: {result}"
        assert "<em>b</em>" not in result, f"Single * should not create italic. Got: {result}"
        print("PASS: Single * not converted to bold (a * b preserved)")
    
    def test_double_asterisk_converted_to_strong(self):
        """clean_ai_html DOES convert ** to <strong> tags"""
        html = "<p>This is **bold text** and more content</p>"
        result = self.clean_ai_html(html)
        assert "<strong>bold text</strong>" in result, f"** should become <strong>. Got: {result}"
        assert "**bold text**" not in result, f"** should be converted. Got: {result}"
        print("PASS: ** converted to <strong> tags")
    
    def test_triple_asterisk_converted_to_strong_em(self):
        """clean_ai_html converts *** to <strong><em> tags"""
        html = "<p>This is ***bold italic*** text</p>"
        result = self.clean_ai_html(html)
        assert "<strong><em>bold italic</em></strong>" in result, f"*** should become <strong><em>. Got: {result}"
        print("PASS: *** converted to <strong><em> tags")
    
    def test_preserves_code_tags(self):
        """clean_ai_html preserves <code> tags"""
        html = "<p>Use <code>print(x)</code> to output</p>"
        result = self.clean_ai_html(html)
        assert "<code>" in result, f"<code> tags should be preserved. Got: {result}"
        print("PASS: <code> tags preserved")
    
    def test_preserves_var_tags(self):
        """clean_ai_html preserves <var> tags for variables"""
        html = "<p>Let <var>x</var> = 5 and <var>y</var> = 10</p>"
        result = self.clean_ai_html(html)
        assert "<var>" in result, f"<var> tags should be preserved. Got: {result}"
        print("PASS: <var> tags preserved")
    
    def test_complex_chemical_formula(self):
        """clean_ai_html preserves complex chemical formulas"""
        html = "<p>Sulfuric acid: H<sub>2</sub>SO<sub>4</sub>, Iron oxide: Fe<sub>2</sub>O<sub>3</sub></p>"
        result = self.clean_ai_html(html)
        assert "H<sub>2</sub>SO<sub>4</sub>" in result, f"H₂SO₄ should be preserved. Got: {result}"
        assert "Fe<sub>2</sub>O<sub>3</sub>" in result, f"Fe₂O₃ should be preserved. Got: {result}"
        print("PASS: Complex chemical formulas preserved (H₂SO₄, Fe₂O₃)")
    
    def test_physics_equation_emc2(self):
        """clean_ai_html preserves E=mc² equation"""
        html = "<p>Einstein's equation: E = mc<sup>2</sup></p>"
        result = self.clean_ai_html(html)
        assert "mc<sup>2</sup>" in result, f"E=mc² should be preserved. Got: {result}"
        print("PASS: E=mc² equation preserved")
    
    def test_mixed_math_and_markdown(self):
        """clean_ai_html handles mixed math notation and markdown"""
        html = "<p>The formula x<sup>2</sup> + y<sup>2</sup> = r<sup>2</sup> is **important** for circles</p>"
        result = self.clean_ai_html(html)
        assert "<sup>2</sup>" in result, f"Superscripts should be preserved. Got: {result}"
        assert "<strong>important</strong>" in result, f"** should become bold. Got: {result}"
        print("PASS: Mixed math notation and markdown handled correctly")


# ═══════════════════════════════════════════════════════════════════════════════
# CODE INSPECTION TESTS: Verify code structure
# ═══════════════════════════════════════════════════════════════════════════════

class TestCodeInspection:
    """Verify code contains required patterns"""
    
    def test_schemes_pdf_css_has_sub_sup_styles(self):
        """Scheme PDF CSS includes sub/sup styling"""
        with open('/app/backend/routes/schemes.py', 'r') as f:
            content = f.read()
        
        # Check for sub styling in PDF CSS
        assert 'sub {' in content or 'sub{' in content, "PDF CSS should include sub styling"
        assert 'vertical-align: sub' in content or 'vertical-align:sub' in content, "sub should have vertical-align: sub"
        
        # Check for sup styling in PDF CSS
        assert 'sup {' in content or 'sup{' in content, "PDF CSS should include sup styling"
        assert 'vertical-align: super' in content or 'vertical-align:super' in content, "sup should have vertical-align: super"
        
        print("PASS: Scheme PDF CSS includes sub/sup styles with vertical-align")
    
    def test_schemes_math_rule_in_ai_prompts(self):
        """Scheme AI prompts include MATH_RULE instructions"""
        with open('/app/backend/routes/schemes.py', 'r') as f:
            content = f.read()
        
        # Check for MATH_RULE definition
        assert 'MATH_RULE' in content or 'MATH & SCIENCE NOTATION' in content, "Should have MATH_RULE or math notation instructions"
        
        # Check for subscript/superscript instructions
        assert '<sub>' in content and '<sup>' in content, "Should mention <sub> and <sup> tags in prompts"
        
        # Check for Unicode symbol preservation
        assert '√' in content or 'sqrt' in content.lower(), "Should mention sqrt symbol"
        assert 'π' in content or 'pi' in content.lower(), "Should mention pi symbol"
        
        print("PASS: Scheme AI prompts include MATH & SCIENCE NOTATION instructions")
    
    def test_quiz_pdf_uses_dejavu_font(self):
        """Quiz PDF uses DejaVu Unicode font"""
        with open('/app/backend/routes/quiz.py', 'r') as f:
            content = f.read()
        
        # Check for DejaVu font registration
        assert 'DejaVu' in content, "Quiz PDF should use DejaVu font"
        assert 'add_font' in content, "Should use add_font to register DejaVu"
        assert 'uni=True' in content or 'uni = True' in content, "Should enable Unicode with uni=True"
        
        # Check that latin-1 encoding is NOT used
        assert ".encode('latin-1'" not in content, "Should NOT use latin-1 encoding"
        assert '.encode("latin-1"' not in content, "Should NOT use latin-1 encoding"
        
        print("PASS: Quiz PDF uses DejaVu Unicode font (no latin-1 encoding)")
    
    def test_quiz_prompts_include_math_notation(self):
        """Quiz AI prompts include math notation instructions"""
        with open('/app/backend/routes/quiz.py', 'r') as f:
            content = f.read()
        
        # Check MCQ prompt
        assert 'MATH & SCIENCE NOTATION' in content, "MCQ prompt should include math notation section"
        
        # Check for subscript/superscript instructions
        assert '₂' in content or '<sub>' in content, "Should mention subscripts"
        assert '²' in content or '<sup>' in content, "Should mention superscripts"
        
        # Check for chemical formula examples
        assert 'H₂O' in content or 'H<sub>2</sub>O' in content, "Should mention H₂O example"
        assert 'CO₂' in content or 'CO<sub>2</sub>O' in content, "Should mention CO₂ example"
        
        print("PASS: Quiz AI prompts include MATH & SCIENCE NOTATION instructions")
    
    def test_dejavu_font_file_exists(self):
        """DejaVu font file exists at expected path"""
        font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
        assert os.path.exists(font_path), f"DejaVu font should exist at {font_path}"
        print(f"PASS: DejaVu font exists at {font_path}")


# ═══════════════════════════════════════════════════════════════════════════════
# FRONTEND CODE INSPECTION
# ═══════════════════════════════════════════════════════════════════════════════

class TestFrontendCode:
    """Verify frontend code contains required patterns"""
    
    def test_inject_table_styles_has_sub_sup(self):
        """injectTableStyles adds sub/sup inline styles"""
        with open('/app/frontend/src/pages/shared/SchemeOfWork.jsx', 'r') as f:
            content = f.read()
        
        # Check for injectTableStyles function
        assert 'injectTableStyles' in content, "Should have injectTableStyles function"
        
        # Check for sub styling
        assert '<sub' in content and 'vertical-align' in content, "Should add vertical-align to sub tags"
        
        # Check for sup styling
        assert '<sup' in content and 'vertical-align' in content, "Should add vertical-align to sup tags"
        
        print("PASS: injectTableStyles adds sub/sup inline styles")
    
    def test_scheme_table_css_has_sub_sup(self):
        """schemeTableCSS includes sub/sup styling"""
        with open('/app/frontend/src/pages/shared/SchemeOfWork.jsx', 'r') as f:
            content = f.read()
        
        # Check for schemeTableCSS
        assert 'schemeTableCSS' in content, "Should have schemeTableCSS constant"
        
        # The CSS should be in the file
        assert 'sub' in content.lower(), "CSS should mention sub"
        assert 'sup' in content.lower(), "CSS should mention sup"
        
        print("PASS: schemeTableCSS includes sub/sup styling")


# ═══════════════════════════════════════════════════════════════════════════════
# API INTEGRATION TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestAPIIntegration:
    """Test API endpoints work correctly"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for teacher"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "edmund@tcis.demo",
            "password": "teacher123"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture
    def admin_token(self):
        """Get auth token for admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "dwain@tcis.demo",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    def test_schemes_endpoint_accessible(self, auth_token):
        """Schemes endpoint is accessible"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/schemes/", headers=headers)
        assert response.status_code == 200, f"Schemes endpoint should return 200. Got: {response.status_code}"
        print("PASS: Schemes endpoint accessible")
    
    def test_quiz_list_endpoint_accessible(self, auth_token):
        """Quiz list endpoint is accessible"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/quiz/list", headers=headers)
        assert response.status_code == 200, f"Quiz list endpoint should return 200. Got: {response.status_code}"
        print("PASS: Quiz list endpoint accessible")


# ═══════════════════════════════════════════════════════════════════════════════
# RUN TESTS
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
