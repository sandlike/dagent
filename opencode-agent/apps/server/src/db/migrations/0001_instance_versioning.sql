-- 0001: 实例版本管理
-- 新增字段：display_name / group_id / version_num / is_active
-- 旧数据迁移：group_id = name（兼容旧 K8s 资源名）、version_num = 1、is_active = 1、display_name = name

-- 1. 加列（IF NOT EXISTS 等价：用 information_schema 判断，幂等）
-- MySQL 不支持 ADD COLUMN IF NOT EXISTS（8.0.29+ 才支持），用存储过程兜底
DROP PROCEDURE IF EXISTS `oma_add_col_if_missing`;
DELIMITER $$
CREATE PROCEDURE `oma_add_col_if_missing`(IN tbl VARCHAR(64), IN col VARCHAR(64), IN defn TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col
  ) THEN
    SET @s = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', defn);
    PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

CALL `oma_add_col_if_missing`('instances', 'display_name', "VARCHAR(128) NOT NULL DEFAULT ''");
CALL `oma_add_col_if_missing`('instances', 'group_id',     "VARCHAR(32) NOT NULL DEFAULT ''");
CALL `oma_add_col_if_missing`('instances', 'version_num',  "INT NOT NULL DEFAULT 1");
CALL `oma_add_col_if_missing`('instances', 'is_active',    "TINYINT(1) NOT NULL DEFAULT 1");

DROP PROCEDURE IF EXISTS `oma_add_col_if_missing`;

-- 2. 旧数据回填：group_id/version_num/is_active/display_name 为空时填默认值
UPDATE `instances`
  SET `group_id` = `name`,
      `version_num` = 1,
      `is_active` = 1,
      `display_name` = CASE WHEN `display_name` = '' THEN `name` ELSE `display_name` END
  WHERE `group_id` = '' OR `display_name` = '';

-- 3. 新增索引（忽略已存在错误）
DROP PROCEDURE IF EXISTS `oma_add_idx_if_missing`;
DELIMITER $$
CREATE PROCEDURE `oma_add_idx_if_missing`(IN tbl VARCHAR(64), IN idx VARCHAR(64), IN cols TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND INDEX_NAME = idx
  ) THEN
    SET @s = CONCAT('CREATE INDEX `', idx, '` ON `', tbl, '` (', cols, ')');
    PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

CALL `oma_add_idx_if_missing`('instances', 'idx_group',        '`group_id`');
CALL `oma_add_idx_if_missing`('instances', 'idx_group_active', '`group_id`, `is_active`');

DROP PROCEDURE IF EXISTS `oma_add_idx_if_missing`;
