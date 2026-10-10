"""
TCIS Knowledge Base — Approved WP documents become searchable institutional wiki articles.
Browse by department/category, search, and view approved docs.
"""
from fastapi import APIRouter, Depends, Body, HTTPException
from database import db
from auth import get_current_user
from datetime import datetime, timezone

router = APIRouter(prefix="/api/knowledge-base", tags=["knowledge_base"])


@router.get("/articles")
async def list_articles(category: str = "", department: str = "", q: str = "", user: dict = Depends(get_current_user)):
    """List all approved WP documents as knowledge base articles."""
    query = {"status": "approved"}
    if category:
        query["kb_category"] = category
    if department:
        query["department"] = department
    if q:
        regex = {"$regex": q, "$options": "i"}
        query["$or"] = [{"title": regex}, {"description": regex}, {"kb_tags": regex}]

    docs = await db.wp_documents.find(query, {"_id": 0}).sort("approved_at", -1).to_list(100)

    articles = []
    for d in docs:
        folder = None
        if d.get("folder_id"):
            folder = await db.wp_folders.find_one({"folder_id": d["folder_id"]}, {"_id": 0, "name": 1})
        author = await db.users.find_one({"user_id": d.get("author_id", "")}, {"_id": 0, "name": 1, "role": 1})
        articles.append({
            "article_id": d["document_id"],
            "title": d.get("title", "Untitled"),
            "description": d.get("description", ""),
            "category": d.get("kb_category", d.get("classification", "general")),
            "department": d.get("department", folder.get("name", "") if folder else ""),
            "tags": d.get("kb_tags", []),
            "author_name": author.get("name", "") if author else "",
            "author_role": author.get("role", "") if author else "",
            "file_id": d.get("file_id", ""),
            "file_type": d.get("file_type", ""),
            "watermark": d.get("watermark", ""),
            "signatures_count": len(d.get("signatures", [])),
            "views": d.get("kb_views", 0),
            "approved_at": d.get("approved_at", d.get("created_at", "")),
            "created_at": d.get("created_at", ""),
        })

    return articles


@router.get("/categories")
async def list_categories(user: dict = Depends(get_current_user)):
    """Get unique categories and departments from approved docs."""
    docs = await db.wp_documents.find({"status": "approved"}, {"_id": 0, "kb_category": 1, "department": 1, "classification": 1}).to_list(500)
    categories = set()
    departments = set()
    for d in docs:
        cat = d.get("kb_category") or d.get("classification") or "general"
        categories.add(cat)
        dept = d.get("department", "")
        if dept:
            departments.add(dept)

    # Also pull folder names as departments
    folders = await db.wp_folders.find({"parent_id": {"$in": [None, ""]}}, {"_id": 0, "name": 1}).to_list(50)
    for f in folders:
        departments.add(f["name"])

    return {
        "categories": sorted(list(categories)),
        "departments": sorted(list(departments)),
    }


@router.get("/articles/{article_id}")
async def get_article(article_id: str, user: dict = Depends(get_current_user)):
    """Get a specific knowledge base article (approved WP doc) and increment views."""
    doc = await db.wp_documents.find_one({"document_id": article_id, "status": "approved"}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Article not found or not approved")

    # Increment view count
    await db.wp_documents.update_one({"document_id": article_id}, {"$inc": {"kb_views": 1}})

    author = await db.users.find_one({"user_id": doc.get("author_id", "")}, {"_id": 0, "name": 1, "role": 1})
    comments = await db.wp_comments.find({"document_id": article_id}, {"_id": 0}).sort("created_at", -1).to_list(20)

    return {
        "article_id": doc["document_id"],
        "title": doc.get("title", "Untitled"),
        "description": doc.get("description", ""),
        "content": doc.get("content", ""),
        "category": doc.get("kb_category", doc.get("classification", "general")),
        "department": doc.get("department", ""),
        "tags": doc.get("kb_tags", []),
        "author_name": author.get("name", "") if author else "",
        "author_role": author.get("role", "") if author else "",
        "file_id": doc.get("file_id", ""),
        "file_type": doc.get("file_type", ""),
        "watermark": doc.get("watermark", ""),
        "signatures": doc.get("signatures", []),
        "views": doc.get("kb_views", 0) + 1,
        "approved_at": doc.get("approved_at", ""),
        "created_at": doc.get("created_at", ""),
        "comments": comments,
    }


@router.put("/articles/{article_id}/metadata")
async def update_article_metadata(article_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    """Update KB-specific metadata (category, tags, department) on an approved doc."""
    doc = await db.wp_documents.find_one({"document_id": article_id}, {"_id": 0, "author_id": 1})
    if not doc:
        raise HTTPException(404, "Article not found")

    update = {}
    if "category" in data:
        update["kb_category"] = data["category"]
    if "tags" in data:
        update["kb_tags"] = data["tags"]
    if "department" in data:
        update["department"] = data["department"]

    if update:
        await db.wp_documents.update_one({"document_id": article_id}, {"$set": update})
    return {"message": "Metadata updated"}


@router.get("/stats")
async def kb_stats(user: dict = Depends(get_current_user)):
    """Get knowledge base statistics."""
    total = await db.wp_documents.count_documents({"status": "approved"})
    total_views = 0
    docs = await db.wp_documents.find({"status": "approved"}, {"_id": 0, "kb_views": 1}).to_list(1000)
    for d in docs:
        total_views += d.get("kb_views", 0)

    recent = await db.wp_documents.find({"status": "approved"}, {"_id": 0, "document_id": 1, "title": 1, "approved_at": 1}).sort("approved_at", -1).to_list(5)
    popular = await db.wp_documents.find({"status": "approved", "kb_views": {"$gt": 0}}, {"_id": 0, "document_id": 1, "title": 1, "kb_views": 1}).sort("kb_views", -1).to_list(5)

    return {
        "total_articles": total,
        "total_views": total_views,
        "recent_articles": recent,
        "popular_articles": popular,
    }
