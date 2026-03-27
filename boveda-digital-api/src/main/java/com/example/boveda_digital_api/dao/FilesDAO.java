package com.example.boveda_digital_api.dao;

import com.example.boveda_digital_api.entity.FilesEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface FilesDAO extends JpaRepository<FilesEntity, UUID> {
}
